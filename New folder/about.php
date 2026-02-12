<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Work2Now - Despre</title>
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

    <main>
      <section class="section">
        <div class="container">
          <h2>Despre Work2Now</h2>
          <p>
            Work2Now este o platforma digitala moderna care conecteaza angajatori si
            persoane care cauta joburi flexibile. Mai jos gasesti pagini separate
            pentru fiecare subiect important.
          </p>
          <div class="feature-grid">
            <div class="feature">
              <h3>Ce este Work2Now</h3>
              <p>Descrierea platformei si beneficiile pentru utilizatori.</p>
              <a class="btn btn-secondary" href="ce-este.php">Deschide</a>
            </div>
            <div class="feature">
              <h3>Cum functioneaza</h3>
              <p>Pasii de creare a profilului si aplicarea la joburi.</p>
              <a class="btn btn-secondary" href="cum-functioneaza.php">Deschide</a>
            </div>
            <div class="feature">
              <h3>Pentru angajatori</h3>
              <p>Beneficii si fluxul de recrutare digital.</p>
              <a class="btn btn-secondary" href="angajatori.php">Deschide</a>
            </div>
            <div class="feature">
              <h3>Aplicatie</h3>
              <p>Aplicatia mobila si utilizarea zilnica.</p>
              <a class="btn btn-secondary" href="aplicatie.php">Deschide</a>
            </div>
            <div class="feature">
              <h3>Locatii</h3>
              <p>Zonele unde platforma este activa.</p>
              <a class="btn btn-secondary" href="locatii.php">Deschide</a>
            </div>
            <div class="feature">
              <h3>Pe scurt</h3>
              <p>Rezumat rapid despre Work2Now.</p>
              <a class="btn btn-secondary" href="pe-scurt.php">Deschide</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
