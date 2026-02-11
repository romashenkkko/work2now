<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;

$success = "";
$error = "";

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $name = trim($_POST["name"] ?? "");
  $email = trim($_POST["email"] ?? "");
  $subject = trim($_POST["subject"] ?? "");
  $message = trim($_POST["message"] ?? "");

  if ($name && $email && $subject && $message) {
    // Aici poti adauga logica de trimitere email sau salvare in baza de date
    $success = "Mesajul tau a fost trimis cu succes! Te vom contacta in curand.";
  } else {
    $error = "Te rugam sa completezi toate campurile.";
  }
}
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Contact</title>
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
        <button class="mobile-menu-toggle" aria-label="Toggle menu" type="button">
          <span></span>
          <span></span>
          <span></span>
        </button>
        <nav class="nav">
          <a href="index.php">Home</a>
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
            <a class="btn btn-signup" href="#" id="signup-trigger">Sign Up</a>
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
        <div class="container" style="max-width: 800px;">
          <h1>Contacteaza-ne</h1>
          <p class="lead">Ai intrebari? Vrem sa te ajutam! Trimite-ne un mesaj si iti vom raspunde in cel mai scurt timp.</p>

          <?php if ($success): ?>
            <div style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); color: #4caf50; padding: 16px; border-radius: 12px; margin: 24px 0;">
              <?php echo htmlspecialchars($success); ?>
            </div>
          <?php endif; ?>

          <?php if ($error): ?>
            <div style="background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); color: #f44336; padding: 16px; border-radius: 12px; margin: 24px 0;">
              <?php echo htmlspecialchars($error); ?>
            </div>
          <?php endif; ?>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; margin: 40px 0;">
            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="font-size: 2.5rem; margin-bottom: 16px;">📧</div>
              <h3 style="margin-bottom: 8px;">Email</h3>
              <p style="color: #6b748a; margin: 0;"><a href="mailto:contact@time2go.local" style="color: #7a63f1;">contact@time2go.local</a></p>
            </div>

            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="font-size: 2.5rem; margin-bottom: 16px;">📱</div>
              <h3 style="margin-bottom: 8px;">Telefon</h3>
              <p style="color: #6b748a; margin: 0;"><a href="tel:+37360123456" style="color: #7a63f1;">+373 60 123 456</a></p>
            </div>

            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="font-size: 2.5rem; margin-bottom: 16px;">📍</div>
              <h3 style="margin-bottom: 8px;">Locatie</h3>
              <p style="color: #6b748a; margin: 0;">Chisinau, Moldova</p>
            </div>
          </div>

          <form method="POST" action="contact.php" style="background: rgba(255, 255, 255, 0.7); padding: 40px; border-radius: 24px; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); margin-top: 40px;">
            <div style="margin-bottom: 24px;">
              <label for="name" style="display: block; margin-bottom: 8px; color: #1e1c2f; font-weight: 600;">Nume complet *</label>
              <input type="text" id="name" name="name" required style="width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(122, 99, 241, 0.3); font-size: 1rem; background: white;" />
            </div>

            <div style="margin-bottom: 24px;">
              <label for="email" style="display: block; margin-bottom: 8px; color: #1e1c2f; font-weight: 600;">Email *</label>
              <input type="email" id="email" name="email" required style="width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(122, 99, 241, 0.3); font-size: 1rem; background: white;" />
            </div>

            <div style="margin-bottom: 24px;">
              <label for="subject" style="display: block; margin-bottom: 8px; color: #1e1c2f; font-weight: 600;">Subiect *</label>
              <input type="text" id="subject" name="subject" required style="width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(122, 99, 241, 0.3); font-size: 1rem; background: white;" />
            </div>

            <div style="margin-bottom: 32px;">
              <label for="message" style="display: block; margin-bottom: 8px; color: #1e1c2f; font-weight: 600;">Mesaj *</label>
              <textarea id="message" name="message" required rows="6" style="width: 100%; padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(122, 99, 241, 0.3); font-size: 1rem; background: white; resize: vertical; font-family: inherit;"></textarea>
            </div>

            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 1.1rem;">Trimite mesajul</button>
          </form>
        </div>
      </section>
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

    <!-- Role Selection Modal -->
    <div class="role-modal" id="roleModal">
      <div class="role-modal-overlay"></div>
      <div class="role-modal-content">
        <button class="role-modal-close" id="closeModal">&times;</button>
        <h2 class="role-modal-title">Please select your role</h2>
        <p class="role-modal-question">Are you a staff or a customer?</p>
        <div class="role-options">
          <div class="role-option" data-role="staff">
            <div class="role-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="role-info">
              <h3>Staff</h3>
              <p>I'm looking for jobs</p>
            </div>
          </div>
          <div class="role-option" data-role="customer">
            <div class="role-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6H16L14 4H10L8 6H4C2.9 6 2 6.9 2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="role-info">
              <h3>Customer</h3>
              <p>I'm looking for staff</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script>
      // Modal functionality
      const signupTrigger = document.getElementById('signup-trigger');
      if (signupTrigger) {
        const modal = document.getElementById('roleModal');
        const closeModal = document.getElementById('closeModal');
        const roleOptions = document.querySelectorAll('.role-option');

        // Open modal
        signupTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        });

        // Close modal
        closeModal.addEventListener('click', () => {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        });

        // Close on overlay click
        modal.querySelector('.role-modal-overlay').addEventListener('click', () => {
          modal.classList.remove('active');
          document.body.style.overflow = '';
        });

        // Select role and redirect
        roleOptions.forEach(option => {
          option.addEventListener('click', () => {
            const role = option.getAttribute('data-role');
            window.location.href = `register.php?role=${role}`;
          });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
          }
        });
      }

      // Mobile menu toggle
      const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
      const nav = document.querySelector('.nav');
      const headerActions = document.querySelector('.header-actions');

      if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
          mobileMenuToggle.classList.toggle('active');
          nav.classList.toggle('active');
          if (headerActions) {
            headerActions.classList.toggle('active');
          }
          document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        });

        const navLinks = nav.querySelectorAll('a');
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            nav.classList.remove('active');
            if (headerActions) {
              headerActions.classList.remove('active');
            }
            document.body.style.overflow = '';
          });
        });

        document.addEventListener('click', (e) => {
          if (!nav.contains(e.target) && !mobileMenuToggle.contains(e.target) && !headerActions?.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            nav.classList.remove('active');
            if (headerActions) {
              headerActions.classList.remove('active');
            }
            document.body.style.overflow = '';
          }
        });
      }
    </script>
  </body>
</html>
