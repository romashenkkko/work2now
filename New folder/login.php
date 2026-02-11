<?php

session_start();
require __DIR__ . "/db.php";

$errors = [];

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $email = trim($_POST["email"] ?? "");
  $password = $_POST["password"] ?? "";

  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = "Email invalid.";
  }

  if ($password === "") {
    $errors[] = "Parola este obligatorie.";
  }

  if (!$errors) {
    $stmt = $mysqli->prepare("SELECT id, name, password_hash FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if ($user && password_verify($password, $user["password_hash"])) {
      $_SESSION["user_id"] = $user["id"];
      $_SESSION["user_name"] = $user["name"];
      header("Location: dashboard.php");
      exit;
    }

    $errors[] = "Email sau parola incorecta.";
  }
}
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Autentificare</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body class="auth-page">
    <div class="auth-card">
      <h1>Autentificare</h1>
      <p class="muted">Acceseaza rapid contul tau Time2Go.</p>

      <?php if ($errors): ?>
        <div class="alert error">
          <?php foreach ($errors as $error): ?>
            <p><?php echo htmlspecialchars($error); ?></p>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <form class="auth-form" method="post">
        <label>
          Email
          <input type="email" name="email" required />
        </label>
        <label>
          Parola
          <input type="password" name="password" required />
        </label>
        <button class="btn btn-primary" type="submit">Autentifica-te</button>
      </form>

      <p class="auth-link">Nu ai cont? <a href="register.php">Creeaza cont</a></p>
      <p class="auth-link"><a href="index.php">Inapoi la site</a></p>
    </div>
  </body>
</html>
