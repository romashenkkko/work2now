<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Ce este</title>
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
      <div class="container">
        <h2>Ce este Time2Go</h2>
        <p>
          Time2Go este o solutie moderna de potrivire intre cererea de personal
          si oferta de munca, folosind tehnologie digitala in locul agentiilor
          traditionale de recrutare. Platforma este complet digitalizata si
          gratuita pentru utilizatori, atat pentru cei care cauta un loc de munca,
          cat si pentru angajatori.
        </p>
        <div class="feature-grid">
          <div class="feature">
            <h3>Profil inteligent</h3>
            <p>Creezi un profil si iti evidentiezi abilitatile si experienta.</p>
          </div>
          <div class="feature">
            <h3>Joburi flexibile</h3>
            <p>Ideal pentru studenti, joburi part-time sau sarcini ocazionale.</p>
          </div>
          <div class="feature">
            <h3>Zero birocratie</h3>
            <p>Gasesti oferte potrivite fara interviuri lungi si hartii inutile.</p>
          </div>
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
