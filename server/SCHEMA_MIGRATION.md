# Database Schema Migration to .NET-Style Architecture

## Overview

The database has been redesigned to match a .NET-style architecture with UUID primary keys and enum-based status fields, while maintaining **100% backward compatibility** with existing endpoints and frontend contracts.

## New Tables Created

### 1. Users (Canonical Identity Table)
- `Id` CHAR(36) PRIMARY KEY (UUID)
- `CreatedAt` DATETIME NOT NULL
- `Email` VARCHAR(191) NOT NULL UNIQUE
- `PasswordHash` VARCHAR(255) NOT NULL
- `Role` INT NOT NULL (enum: UserRole)

### 2. BusinessProfiles
- `Id` CHAR(36) PRIMARY KEY
- `UserId` CHAR(36) NOT NULL UNIQUE → FK to Users(Id)
- `CompanyName`, `ContactPersonName`, `ContactPersonSurname`, `IDNO` TEXT
- `CompanyCategory` INT (enum: CompanyCategory)
- `InfoForStaff` TEXT

### 3. Branches
- `Id` CHAR(36) PRIMARY KEY
- `BusinessProfileId` CHAR(36) → FK to BusinessProfiles(Id)
- `Name`, `Address`, `City`, `Country`, `PhoneNumber` TEXT
- `IsActive` TINYINT(1) DEFAULT 1
- `CreatedAt` DATETIME

### 4. EmployeeProfiles
- `Id` CHAR(36) PRIMARY KEY
- `UserId` CHAR(36) NOT NULL UNIQUE → FK to Users(Id)
- `IDNP`, `Name`, `Surname` TEXT
- `DateOfBirth` DATE
- `AboutMe` TEXT
- `ProfilePictureFileId` TEXT NULL

### 5. Experiences
- `Id` CHAR(36) PRIMARY KEY
- `EmployeeProfileId` CHAR(36) → FK to EmployeeProfiles(Id)
- `JobCategory` INT (enum: JobCategory)
- `Duration` INT (enum: ExperienceDuration)
- `Description` TEXT

### 6. UserLegacyMap (Migration Helper)
- `legacy_user_id` INT UNSIGNED PRIMARY KEY (maps to old users.id)
- `user_uuid` CHAR(36) UNIQUE (maps to new Users.Id)

## Legacy Tables (Maintained for Backward Compatibility)

All existing tables are preserved with their original structure:
- `users` (INT id, VARCHAR fields)
- `jobs` (INT id, INT user_id)
- `applications` (INT id, INT staff_id, VARCHAR status)
- `application_work_sessions`
- `ratings` (INT rater_id, INT rated_id)

### New Columns Added to Legacy Tables

- `jobs.user_id_uuid` CHAR(36) - References Users(Id)
- `jobs.vacancy_status_code` INT - Enum value for status
- `applications.staff_id_uuid` CHAR(36) - References Users(Id)
- `applications.status_code` INT - Enum value for status
- `ratings.rater_id_uuid` CHAR(36) - References Users(Id)
- `ratings.rated_id_uuid` CHAR(36) - References Users(Id)

## Enums

All enums are stored as INT in the database:

- **ApplicationStatus**: Open=1, Pending=2, Accepted=3, Rejected=4
- **CompanyCategory**: Cantina=1, Catering=2, Cafe=3, Restaurant=4, Nightclub=5, Hotel=6, Bar=7
- **ExperienceDuration**: NoExperience=1, LessThanOneYear=2, OneToFiveYears=3, MoreThanFiveYears=4
- **JobCategory**: Waiter=1, Chef=2, Dishwasher=3, Barista=4, Bartender=5, Cleaner=6, Receptionist=7, CookAssistant=8
- **UserRole**: Employee=1, Business=2, Admin=3
- **VacancyStatus**: Open=1, InDuration=2, Closed=3

## Migration Process

The migration runs automatically on server startup (`initDatabase()`):

1. **Creates new tables** (Users, BusinessProfiles, Branches, EmployeeProfiles, Experiences, UserLegacyMap)
2. **Adds UUID columns** to legacy tables (safe ALTER TABLE with IF NOT EXISTS checks)
3. **Migrates existing data**:
   - For each legacy user, creates a UUID entry in Users table
   - Creates mapping in UserLegacyMap
   - Creates EmployeeProfile or BusinessProfile based on role
   - Updates UUID columns in jobs, applications, ratings
   - Populates status_code columns from string statuses
4. **Maintains backward compatibility**: All legacy columns remain functional

## API Contract Preservation

### Endpoints Unchanged
- `/api/auth/register` - Still returns `{ message: "..." }`
- `/api/auth/login` - Still returns `{ token: string, user: { id: number, name, email, role, avatar? } }`
- `/api/auth/me` - Still returns `{ id: number, name, email, role, avatar? }`
- `/api/jobs/*` - All endpoints work exactly the same
- `/api/ratings/*` - All endpoints work exactly the same

### Response Formats
- **User IDs**: Still returned as `number` (legacy INT id) for frontend compatibility
- **JWT Payload**: Still uses `userId: number` (legacy INT)
- **Status Fields**: Still returned as strings (`"pending"`, `"accepted"`, etc.) for UI compatibility
- **Error Format**: Still `{ error: "..." }`

### Internal Implementation
- New user registrations create entries in both legacy `users` table and new `Users` table
- Queries can use either legacy INT columns or new UUID columns
- Status codes are stored as INT enums but converted to strings for API responses

## Helper Functions

### `getUserUuidFromLegacyId(legacyId: number): Promise<string | null>`
Maps legacy INT user ID to UUID.

### `getLegacyIdFromUserUuid(userUuid: string): Promise<number | null>`
Maps UUID to legacy INT user ID.

### `createUserWithMapping(email, passwordHash, role, name?): Promise<number>`
Creates user in both legacy and new tables, returns legacy ID for API compatibility.

## Files Modified

1. **server/src/enums/index.ts** - New enum definitions and mapping functions
2. **server/src/db.ts** - Complete schema migration and helper functions
3. **server/src/routes/auth.ts** - Updated to use `createUserWithMapping` for new registrations

## Files Unchanged (Still Compatible)

- **server/src/routes/jobs.ts** - Works with legacy columns
- **server/src/routes/ratings.ts** - Works with legacy columns
- **server/src/middleware/auth.ts** - Still uses `userId: number` in JWT
- **client/src/api/client.ts** - No changes needed

## Testing Checklist

- [x] Database migration runs successfully
- [x] New user registration creates entries in both tables
- [x] Login returns same response format
- [x] Jobs endpoints work with legacy user_id
- [x] Applications endpoints work with legacy staff_id
- [x] Ratings endpoints work with legacy rater_id/rated_id
- [x] Status fields returned as strings (not enum codes)
- [x] JWT still uses numeric userId

## Future Enhancements

The new schema is ready for:
- UUID-based user identification (when frontend is updated)
- Enum-based status queries (more efficient than string comparisons)
- Proper foreign key relationships with cascade deletes
- Extended user profiles (BusinessProfiles, EmployeeProfiles)
- Branch management for businesses
- Experience tracking for employees

## Notes

- **No data loss**: All existing data is preserved and migrated
- **No breaking changes**: All endpoints maintain exact same behavior
- **Dual-write strategy**: New users written to both legacy and new tables
- **Gradual migration**: Can migrate frontend to UUIDs incrementally
- **Rollback safe**: Legacy tables remain fully functional

