<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Blog</title>
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
        <div class="container">
          <h1>Blog Time2Go</h1>
          <p class="lead">Articole, sfaturi si noutati despre recrutare flexibila si piata muncii.</p>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px; margin-top: 48px;">
            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">📝</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">15 Ianuarie 2026</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Cum sa iti creezi un profil atractiv pe Time2Go</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">Sfaturi practice pentru a-ti optimiza profilul si a atrage mai multe oferte de joburi. Afla ce fac angajatorii sa te aleaga.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>

            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">💼</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">10 Ianuarie 2026</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Recrutare flexibila: viitorul angajarii</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">De ce joburile flexibile devin din ce in ce mai populare si cum beneficiaza atat angajatorii cat si angajatii.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>

            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">🚀</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">5 Ianuarie 2026</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Time2Go se extinde in Romania</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">Anuntam lansarea platformei in Romania. Afla cum poti beneficia de serviciile noastre in noul market.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>

            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">💰</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">28 Decembrie 2025</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Plata rapida: cum functioneaza</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">Explicam procesul de plata rapida pe Time2Go si de ce primesti salariul in maxim 48 de ore dupa finalizarea jobului.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>

            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">📱</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">20 Decembrie 2025</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Aplicatia mobila Time2Go</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">Descopera functiile aplicatiei mobile: gestionare joburi, notificari, plata si multe altele.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>

            <article style="background: rgba(255, 255, 255, 0.7); border-radius: 20px; overflow: hidden; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="background: linear-gradient(135deg, #7a63f1, #9d7bff); height: 180px; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">⭐</div>
              <div style="padding: 24px;">
                <div style="color: #7a63f1; font-size: 0.85rem; font-weight: 600; margin-bottom: 12px;">15 Decembrie 2025</div>
                <h3 style="margin: 0 0 12px 0; color: #1e1c2f;">Sfaturi pentru angajatori</h3>
                <p style="color: #6b748a; margin: 0 0 20px 0; line-height: 1.6;">Cum sa scrii anunturi eficiente si sa gasesti personalul potrivit rapid pe Time2Go.</p>
                <a href="#" style="color: #7a63f1; font-weight: 600; text-decoration: none;">Citeste mai mult →</a>
              </div>
            </article>
          </div>

          <div style="text-align: center; margin-top: 48px;">
            <p style="color: #6b748a; margin-bottom: 16px;">Vrei sa primesti notificari despre articole noi?</p>
            <a href="register.php" class="btn btn-primary">Inregistreaza-te acum</a>
          </div>
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
