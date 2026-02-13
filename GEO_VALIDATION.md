# Geolocation Check-In / Check-Out – Implementation & Security

This document describes how workplace geo-validation works and how to keep it secure.

## Overview

- **Browser Geolocation API** is used to get user coordinates (desktop and mobile).
- **Workplace coordinates** (latitude, longitude) are set by the employer when adding a job address on the map.
- **Distance** between user and workplace is computed with the **Haversine formula**.
- **Check-in and check-out** are allowed only if distance ≤ allowed radius (default **200 m**).
- If the user is outside the radius, the backend returns: **"You are not within the allowed location radius."**
- **Backend (Node.js + Express + MySQL)** always validates coordinates so frontend manipulation cannot bypass the rule.

---

## 1. Frontend (JavaScript / React)

### Requesting location permission

Location permission is requested via the browser’s Geolocation API when the user confirms check-in or check-out for a job that has a workplace set.

```javascript
// Request user coordinates (desktop & mobile)
function requestLocationForCheckIn(onSuccess, onError) {
  if (!navigator.geolocation) {
    onError("Geolocation is not supported by this browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      onSuccess({ lat, lng });
    },
    (err) => {
      onError("Location permission is required for check-in/check-out at this workplace.");
    },
    {
      enableHighAccuracy: true,  // Prefer GPS on mobile
      timeout: 15000,             // 15 s max wait
      maximumAge: 0               // Do not use cached position
    }
  );
}
```

### Sending coordinates to the backend

Coordinates are sent in the request body; the backend is the only authority that decides if the user is within range.

```javascript
// Example: check-in with coordinates
async function checkIn(applicationId, workDate, lat, lng) {
  const res = await fetch(`/api/jobs/applications/${applicationId}/check-in`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ workDate, lat, lng })
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error && data.error.includes("not within the allowed location radius")) {
      alert("You are not within the allowed location radius.");
    } else {
      alert(data.error || "Check-in failed.");
    }
    return;
  }
  // Success
}
```

### Flow when job has a workplace

1. User clicks Check-in (or Check-out).
2. If the job has workplace coordinates and radius, call `navigator.geolocation.getCurrentPosition(...)`.
3. On success, send `{ workDate, lat, lng }` to the check-in (or check-out) API.
4. On error (permission denied / timeout), show: "Location permission is required...".
5. If the API returns 400 with "You are not within the allowed location radius.", show that message (or the localized `locationRadiusError`).

---

## 2. Backend validation (Node.js + Express + MySQL)

### Haversine formula (distance in meters)

```javascript
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### Fixed workplace and radius

- Workplace: `(check_in_lat, check_in_lng)` per job in the `jobs` table.
- Allowed radius: `check_in_radius_m` (default **200** m).

### Validation helper (single source of truth)

```javascript
const LOCATION_RADIUS_ERROR = "You are not within the allowed location radius.";
const DEFAULT_GEO_RADIUS_M = 200;

async function validateGeoForJob(jobId, body) {
  const [rows] = await db.query(
    "SELECT check_in_lat, check_in_lng, check_in_radius_m FROM jobs WHERE id = ?",
    [jobId]
  );
  const job = rows[0];
  const jLat = Number(job?.check_in_lat);
  const jLng = Number(job?.check_in_lng);
  const jRadius = Number(job?.check_in_radius_m) || DEFAULT_GEO_RADIUS_M;

  if (!Number.isFinite(jLat) || !Number.isFinite(jLng) || jRadius <= 0) {
    return { valid: true }; // No geo-fence
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, statusCode: 400, error: "Location permission is required for check-in/check-out at this workplace." };
  }

  const distM = haversineMeters(jLat, jLng, lat, lng);
  if (distM > jRadius) {
    return { valid: false, statusCode: 400, error: LOCATION_RADIUS_ERROR };
  }
  return { valid: true };
}
```

### Use in check-in and check-out routes

- Load application and get `job_id`.
- Call `validateGeoForJob(jobId, req.body)`.
- If `!result.valid`, respond with `result.statusCode` and `result.error`.
- Only then update `application_work_sessions` (check-in or check-out).

This ensures **every** check-in/check-out is validated on the server; modified coordinates from the frontend are rejected when outside the radius.

---

## 3. Secure implementation best practices

| Practice | Description |
|----------|-------------|
| **Backend is the authority** | Always validate lat/lng and distance on the server. Never trust the client for “allowed” or “blocked”. |
| **Fixed workplace in DB** | Store workplace coordinates and radius in the database (e.g. `jobs.check_in_lat`, `check_in_lng`, `check_in_radius_m`). Do not accept workplace from the client on check-in/check-out. |
| **Standard error message** | Return a single, predictable message for “outside radius” (e.g. "You are not within the allowed location radius.") so the frontend can map it to a localized string. |
| **Require coordinates when geo is set** | If the job has a workplace and radius, require `lat` and `lng` in the body; otherwise return 400. This prevents “no coordinates” from bypassing the rule. |
| **No sensitive data in error** | Avoid exposing exact distance or workplace coordinates in the response. |
| **HTTPS** | Use HTTPS in production so location and tokens are not sent in clear text. |
| **Auth on every request** | Check-in/check-out must require a valid auth token; validate that the application belongs to the current user. |
| **Rate limiting** | Consider rate limiting check-in/check-out endpoints to reduce abuse. |
| **Browser support** | Use `navigator.geolocation` with fallback message for unsupported browsers; same logic works on desktop and mobile. |

---

## 4. Preventing fake coordinates

- **All** check-in/check-out requests that carry `lat`/`lng` are validated on the backend with Haversine and the job’s stored radius.
- If a user tampers with the frontend and sends fake coordinates:
  - Coordinates that are **inside** the radius will be accepted (they “cheat” by saying they are at work).
  - Coordinates **outside** the radius will be rejected with "You are not within the allowed location radius."
- The server does not trust “I am allowed” from the client; it only trusts: “Here are my coordinates” → compute distance → allow or deny.

To further reduce fake “inside” coordinates (e.g. someone always sending the workplace center), you can later add:
- Optional server-side checks (e.g. max frequency of check-ins from the same device/IP).
- Optional auditing/logging of lat/lng and distance for review.

---

## 5. Summary

- **Frontend:** Use Geolocation API, send `workDate` + `lat` + `lng` for check-in/check-out when the job has a workplace; show "You are not within the allowed location radius." when the API returns that error.
- **Backend:** Store workplace and radius in MySQL; validate every request with Haversine; allow only if distance ≤ radius (default 200 m); return the standard error message when outside.
- **Security:** Backend validation is mandatory and prevents clients from bypassing the rule by modifying the frontend.
