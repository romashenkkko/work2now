<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Pentru angajatori</title>
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
      <div class="container split">
        <div>
          <h2>Pentru angajatori</h2>
          <p>
            Time2Go permite firmelor sa posteze joburi si sa gaseasca personal
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
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <div class="logo small" aria-label="Time2Go logo">
            <span class="logo-mark">
              <img src="LogoTime2Go.png" alt="Time2Go" />
            </span>
            <span class="logo-text">Time2Go</span>
          </div>
          <p>Platforma digitala pentru recrutare flexibila in Moldova si Romania.</p>
        </div>
        <div class="footer-links">
          <a href="ce-este.php">Despre</a>
          <a href="cum-functioneaza.php">Cum functioneaza</a>
          <a href="angajatori.php">Angajatori</a>
          <a href="aplicatie.php">Aplicatie</a>
        </div>
        <div class="footer-links">
          <a href="find-jobs.php">Find Jobs</a>
          <a href="find-staff.php">Find Staff</a>
          <a href="blog.php">Blog</a>
          <a href="contact.php">Contact</a>
        </div>
        <div class="footer-links">
          <a href="login.php">Login</a>
          <a href="register.php">Inregistrare</a>
          <a href="locatii.php">Locatii</a>
        </div>
        <div class="footer-note">
          <p>© 2026 Time2Go. Toate drepturile rezervate.</p>
          <div>
            <a href="#">Politica de confidentialitate</a>
            <span style="margin: 0 12px;">•</span>
            <a href="#">Termeni si conditii</a>
          </div>
        </div>
      </div>
    </footer>
  </body>
</html>
