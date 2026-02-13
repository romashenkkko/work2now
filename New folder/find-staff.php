<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Work2Now - Find Staff</title>
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
          <h1>Gaseste personal calificat</h1>
          <p class="lead">Posteaza joburi si conecteaza-te cu candidatii potriviti pentru afacerea ta.</p>

          <?php if (!$userName): ?>
            <div style="background: rgba(122, 99, 241, 0.1); border: 1px solid rgba(122, 99, 241, 0.3); border-radius: 16px; padding: 24px; margin: 32px 0; text-align: center;">
              <h3 style="color: #7a63f1; margin-bottom: 12px;">Creeaza cont pentru angajatori</h3>
              <p style="color: #4d5874; margin-bottom: 20px;">Inregistreaza-te pentru a posta joburi si a gasi personal rapid.</p>
              <a href="register.php" class="btn btn-primary">Creeaza cont angajator</a>
            </div>
          <?php else: ?>
            <div style="text-align: center; margin: 32px 0;">
              <a href="dashboard.php" class="btn btn-primary" style="padding: 14px 32px; font-size: 1.1rem;">+ Posteaza un job nou</a>
            </div>
          <?php endif; ?>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 40px;">
            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #7a63f1, #9d7bff); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white;">📋</div>
              <h3 style="margin-bottom: 12px;">Posteaza joburi rapid</h3>
              <p style="color: #6b748a;">Creeaza anunturi de job in cateva minute. Specifica cerintele si programul.</p>
            </div>

            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #7a63f1, #9d7bff); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white;">👥</div>
              <h3 style="margin-bottom: 12px;">Vezi candidatii</h3>
              <p style="color: #6b748a;">Browsui profiluri, vezi experienta si rating-urile. Selecteaza cei mai potriviti.</p>
            </div>

            <div class="feature" style="text-align: center; padding: 32px 24px;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #7a63f1, #9d7bff); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white;">⚡</div>
              <h3 style="margin-bottom: 12px;">Recrutare rapida</h3>
              <p style="color: #6b748a;">Contacteaza direct candidatii, programeaza interviuri si finalizeaza angajarea digital.</p>
            </div>
          </div>

          <div style="background: rgba(122, 99, 241, 0.08); border-radius: 24px; padding: 40px; margin-top: 48px; text-align: center;">
            <h2 style="color: #1e1c2f; margin-bottom: 16px;">De ce Work2Now pentru angajatori?</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin-top: 32px;">
              <div>
                <div style="font-size: 2.5rem; font-weight: 700; color: #7a63f1; margin-bottom: 8px;">0%</div>
                <p style="color: #6b748a;">Comisioane ascunse</p>
              </div>
              <div>
                <div style="font-size: 2.5rem; font-weight: 700; color: #7a63f1; margin-bottom: 8px;">24/7</div>
                <p style="color: #6b748a;">Acces la platforma</p>
              </div>
              <div>
                <div style="font-size: 2.5rem; font-weight: 700; color: #7a63f1; margin-bottom: 8px;">48h</div>
                <p style="color: #6b748a;">Plata rapida pentru lucratori</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <div class="logo small" aria-label="Work2Now logo">
            <span class="logo-mark">
              <img src="LogoWork2Now.png" alt="Work2Now" />
            </span>
            <span class="logo-text">Work2Now</span>
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
          <p>© 2026 Work2Now. Toate drepturile rezervate.</p>
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

      // Mark body as having scroll animations
      document.body.classList.add('has-scroll-animations');

      // Scroll-based animations for all elements
      function initScrollAnimations() {
        // Animate header only once on page load
        const header = document.querySelector('.site-header');
        if (header && !sessionStorage.getItem('headerAnimated')) {
          // Run animation immediately on first page load
          header.classList.add('animate-in');
          sessionStorage.setItem('headerAnimated', 'true');
        } else if (header) {
          // If already animated, make it visible immediately
          header.style.opacity = '1';
          header.style.transform = 'translateY(0) scaleY(1)';
        }

        // Animate all sections when they become visible
        const sections = document.querySelectorAll('main > section');
        sections.forEach((section, index) => {
          const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                sectionObserver.unobserve(entry.target);
              }
            });
          }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          });
          sectionObserver.observe(section);
        });
      }

      // Initialize scroll animations
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollAnimations);
      } else {
        initScrollAnimations();
      }
    </script>
  </body>
</html>
