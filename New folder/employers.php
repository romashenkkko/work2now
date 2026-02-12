<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Work2Now - Angajatori</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <header class="site-header">
      <div class="container header-inner">
        <div class="logo" aria-label="Work2Now logo">
          <span class="logo-mark">
            <img src="LogoWork2Now.png" alt="Work2Now" />
          </span>
          <span class="logo-text">Work2Now</span>
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

    <main class="section">
      <div class="container">
        <div class="split">
          <div>
            <h2>Pentru angajatori</h2>
            <p>
              Work2Now permite firmelor sa posteze joburi si sa gaseasca personal
              calificat rapid si eficient. Poti testa lucratorii pentru cateva ore
              si ii poti pastra pe cei buni fara costuri suplimentare.
            </p>
            <ul class="checklist">
              <li>Recrutare fara costuri ascunse</li>
              <li>Personal calificat disponibil rapid</li>
              <li>Joburi part-time, full-time sau pe proiect</li>
            </ul>
          </div>
          <div class="card">
            <h3>Beneficii cheie</h3>
            <p>Publici anuntul, alegi candidatii si finalizezi procesul digital.</p>
            <a class="btn btn-secondary" href="contact.php">Discuta cu noi</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
