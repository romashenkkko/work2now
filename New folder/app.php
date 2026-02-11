<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Aplicatie</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <div class="logo" aria-label="Time2Go logo">
          <span class="logo-mark">
            <img src="LogoTime2Go.png" alt="Time2Go" />
          </span>
          <span class="logo-text">Time2Go</span>
        </div>
        <nav class="nav">
          <a href="index.php">Home</a>
          <a href="about.php">Despre</a>
          <a href="how-it-works.php">Cum functioneaza</a>
          <a href="employers.php">Angajatori</a>
          <a href="app.php">Aplicatie</a>
          <a href="locations.php">Locatii</a>
          <a href="find-jobs.php">Find Jobs</a>
          <a href="find-staff.php">Find Staff</a>
          <a href="contact.php">Contact Us</a>
          <a href="blog.php">The Blog</a>
        </nav>
        <div class="header-actions">
          <?php if ($userName): ?>
            <a class="btn btn-signup" href="dashboard.php">Salut, <?php echo htmlspecialchars($userName); ?></a>
            <a class="btn btn-signin" href="logout.php">Logout</a>
          <?php else: ?>
            <a class="btn btn-signin" href="login.php">Sign In</a>
            <a class="btn btn-signup" href="register.php">Sign Up</a>
            <div class="lang-switch">
              <button class="lang-btn" type="button">RO ▾</button>
              <div class="lang-menu">
                <a href="#" aria-label="Romanian">RO</a>
                <a href="#" aria-label="English">EN</a>
                <a href="#" aria-label="Russian">RU</a>
              </div>
            </div>
          <?php endif; ?>
        </div>
      </div>
    </header>

    <main class="section alt">
      <div class="container">
        <h2>Aplicatie si utilizare</h2>
        <p>
          Exista si o aplicatie mobila Time2Go pentru iOS si Android, unde
          utilizatorii pot gestiona joburile, programarile si salariile printr-o
          interfata simpla.
        </p>
        <div class="app-tags">
          <span>iOS</span>
          <span>Android</span>
          <span>Notificari rapide</span>
          <span>Management salarii</span>
        </div>
      </div>
    </main>
  </body>
</html>
