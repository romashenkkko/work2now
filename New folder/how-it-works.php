<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Cum functioneaza</title>
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
        <h2>Cum functioneaza</h2>
        <div class="steps">
          <div class="step">
            <span class="step-index">1</span>
            <h3>Completezi profilul</h3>
            <p>Adaugi abilitatile, experienta si preferintele de program.</p>
          </div>
          <div class="step">
            <span class="step-index">2</span>
            <h3>Aplici la joburi</h3>
            <p>Cauti roluri care se potrivesc locatiei si competentelor tale.</p>
          </div>
          <div class="step">
            <span class="step-index">3</span>
            <h3>Lucrezi si esti platit</h3>
            <p>Accepti proiectul, lucrezi si primesti plata rapid.</p>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
