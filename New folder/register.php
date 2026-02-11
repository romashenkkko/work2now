<?php

session_start();
require __DIR__ . "/db.php";

$errors = [];
$success = "";
$selectedRole = $_GET["role"] ?? "user"; // Get role from URL parameter

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $name = trim($_POST["name"] ?? "");
  $email = trim($_POST["email"] ?? "");
  $password = $_POST["password"] ?? "";
  $confirm = $_POST["confirm"] ?? "";
  $role = $_POST["role"] ?? "user";

  if ($name === "" || strlen($name) < 2) {
    $errors[] = "Numele este prea scurt.";
  }

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = "Email invalid.";
  }

  if (strlen($password) < 6) {
    $errors[] = "Parola trebuie sa aiba minim 6 caractere.";
  }

  if ($password !== $confirm) {
    $errors[] = "Parolele nu coincid.";
  }

  if (!$errors) {
    $stmt = $mysqli->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
      $errors[] = "Email deja folosit.";
    }
    $stmt->close();
  }

  if (!$errors) {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    // Validate role - only allow 'staff' or 'customer', default to 'user'
    if ($role !== "staff" && $role !== "customer") {
      $role = "user";
    }
    $stmt = $mysqli->prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $name, $email, $hash, $role);

    if ($stmt->execute()) {
      $success = "Cont creat cu succes. Acum te poti autentifica.";
    } else {
      $errors[] = "Eroare la inregistrare. Incearca din nou.";
    }
    $stmt->close();
  }
}
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Inregistrare</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body class="auth-page">
    <div class="auth-card">
      <h1>Creaza cont</h1>
      <?php if ($selectedRole === "staff"): ?>
        <p class="muted">Creeaza-ti cont ca Staff pentru a gasi joburi flexibile.</p>
      <?php elseif ($selectedRole === "customer"): ?>
        <p class="muted">Creeaza-ti cont ca Customer pentru a gasi personal calificat.</p>
      <?php else: ?>
        <p class="muted">Intra in platforma Time2Go rapid si sigur.</p>
      <?php endif; ?>

      <?php if ($errors): ?>
        <div class="alert error">
          <?php foreach ($errors as $error): ?>
            <p><?php echo htmlspecialchars($error); ?></p>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($success): ?>
        <div class="alert success"><?php echo htmlspecialchars($success); ?></div>
      <?php endif; ?>

      <form class="auth-form" method="post">
        <input type="hidden" name="role" value="<?php echo htmlspecialchars($selectedRole); ?>" />
        <label>
          Nume complet
          <input type="text" name="name" required />
        </label>
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Parola
          <input type="password" name="password" required />
        </label>
        <label>
          Confirma parola
          <input type="password" name="confirm" required />
        </label>
        <button class="btn btn-primary" type="submit">Inregistrare</button>
      </form>

      <p class="auth-link">Ai deja cont? <a href="login.php">Autentifica-te</a></p>
      <p class="auth-link"><a href="index.php">Inapoi la site</a></p>
    </div>
  </body>
</html>
