<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Find Jobs</title>
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
        <div class="mobile-menu-overlay">
          <?php if ($userName): ?>
            <div class="header-actions">
              <a class="btn btn-signup" href="dashboard.php">Salut, <?php echo htmlspecialchars($userName); ?></a>
              <a class="btn btn-signin" href="logout.php">Logout</a>
            </div>
          <?php else: ?>
            <div class="header-actions">
              <a class="btn btn-signin" href="login.php">Sign In</a>
              <a class="btn btn-signup" href="#" id="signup-trigger-mobile">Sign Up</a>
              <div class="lang-switch">
                <button class="lang-btn" type="button">RO ▾</button>
                <div class="lang-menu">
                  <a href="#" aria-label="Romanian">RO</a>
                  <a href="#" aria-label="English">EN</a>
                  <a href="#" aria-label="Russian">RU</a>
                </div>
              </div>
            </div>
          <?php endif; ?>
          <nav class="nav">
            <a href="index.php">Home</a>
            <a href="find-jobs.php">Find Jobs</a>
            <a href="find-staff.php">Find Staff</a>
            <a href="contact.php">Contact Us</a>
            <a href="blog.php">The Blog</a>
          </nav>
        </div>
      </div>
    </header>

    <main>
      <section class="section">
        <div class="container">
          <h1>Gaseste joburi flexibile</h1>
          <p class="lead">Exploreaza oferte de munca care se potrivesc programului si competentelor tale.</p>

          <div class="search-filters">
            <input type="text" placeholder="Cauta joburi..." />
            <div class="custom-dropdown" data-dropdown="category">
              <button class="dropdown-btn" type="button">
                <span class="dropdown-text">Toate categoriile</span>
                <span class="chevron">▾</span>
              </button>
              <div class="dropdown-menu">
                <div class="dropdown-item selected" data-value="all">Toate categoriile</div>
                <div class="dropdown-item" data-value="hospitality">Ospitalitate</div>
                <div class="dropdown-item" data-value="services">Servicii</div>
                <div class="dropdown-item" data-value="retail">Retail</div>
                <div class="dropdown-item" data-value="events">Eventuri</div>
              </div>
            </div>
            <div class="custom-dropdown" data-dropdown="location">
              <button class="dropdown-btn" type="button">
                <span class="dropdown-text">Toate locatiile</span>
                <span class="chevron">▾</span>
              </button>
              <div class="dropdown-menu">
                <div class="dropdown-item selected" data-value="all">Toate locatiile</div>
                <div class="dropdown-item" data-value="chisinau">Chisinau</div>
                <div class="dropdown-item" data-value="bucuresti">Bucuresti</div>
                <div class="dropdown-item" data-value="iasi">Iasi</div>
              </div>
            </div>
            <button class="btn btn-primary" type="button">Cauta</button>
          </div>

          <div class="jobs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; margin-top: 40px;">
            <div class="job-card" style="background: rgba(255, 255, 255, 0.7); padding: 24px; border-radius: 20px; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #1e1c2f;">Ospatar</h3>
                <span style="background: #7a63f1; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Part-time</span>
              </div>
              <p style="color: #4d5874; margin: 8px 0; font-size: 0.95rem; font-weight: 500;">Restaurant Central, Chisinau</p>
              <p style="color: #34324a; margin: 12px 0; line-height: 1.6;">Cautam ospatar pentru servire clienti in weekend. Experienta preferabila dar nu obligatorie.</p>
              <div style="display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap;">
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Weekend</span>
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Flexibil</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                <span style="font-weight: 700; color: #7a63f1;">150-200 MDL/shift</span>
                <a href="#" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.9rem;">Aplica</a>
              </div>
            </div>

            <div class="job-card" style="background: rgba(255, 255, 255, 0.7); padding: 24px; border-radius: 20px; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #1e1c2f;">Casier</h3>
                <span style="background: #7a63f1; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Full-time</span>
              </div>
              <p style="color: #4d5874; margin: 8px 0; font-size: 0.95rem; font-weight: 500;">Supermarket, Bucuresti</p>
              <p style="color: #34324a; margin: 12px 0; line-height: 1.6;">Cautam casier pentru program flexibil. Training inclus. Plata rapida.</p>
              <div style="display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap;">
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Zi de zi</span>
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Training</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                <span style="font-weight: 700; color: #7a63f1;">2500-3000 RON/luna</span>
                <a href="#" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.9rem;">Aplica</a>
              </div>
            </div>

            <div class="job-card" style="background: rgba(255, 255, 255, 0.7); padding: 24px; border-radius: 20px; border: 1px solid rgba(224, 216, 247, 0.9); backdrop-filter: blur(14px); box-shadow: 0 8px 20px rgba(66, 50, 120, 0.08); transition: transform 0.2s;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <h3 style="margin: 0; color: #1e1c2f;">Event Staff</h3>
                <span style="background: #7a63f1; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">Ocazional</span>
              </div>
              <p style="color: #4d5874; margin: 8px 0; font-size: 0.95rem; font-weight: 500;">Evenimente, Iasi</p>
              <p style="color: #34324a; margin: 12px 0; line-height: 1.6;">Personal pentru evenimente: conferinte, petreceri, lansari. Program flexibil.</p>
              <div style="display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap;">
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Evenimente</span>
                <span style="background: rgba(122, 99, 241, 0.1); color: #7a63f1; padding: 6px 12px; border-radius: 8px; font-size: 0.85rem;">Ocazional</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px;">
                <span style="font-weight: 700; color: #7a63f1;">200-300 RON/event</span>
                <a href="#" class="btn btn-primary" style="padding: 8px 18px; font-size: 0.9rem;">Aplica</a>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 48px;">
            <p style="color: #6b748a; margin-bottom: 16px;">Nu gasesti ce cauti?</p>
            <a href="contact.php" class="btn btn-secondary">Contacteaza-ne</a>
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

    <script>
      // Custom Dropdown Functionality
      document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
        const btn = dropdown.querySelector('.dropdown-btn');
        const menu = dropdown.querySelector('.dropdown-menu');
        const items = dropdown.querySelectorAll('.dropdown-item');
        const textSpan = dropdown.querySelector('.dropdown-text');

        // Toggle dropdown
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isActive = btn.classList.contains('active');
          
          // Close all other dropdowns
          document.querySelectorAll('.custom-dropdown .dropdown-btn').forEach(otherBtn => {
            if (otherBtn !== btn) {
              otherBtn.classList.remove('active');
              otherBtn.nextElementSibling.classList.remove('active');
            }
          });

          // Toggle current dropdown
          btn.classList.toggle('active');
          menu.classList.toggle('active');
        });

        // Select item
        items.forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove selected class from all items
            items.forEach(i => i.classList.remove('selected'));
            
            // Add selected class to clicked item
            item.classList.add('selected');
            
            // Update button text
            textSpan.textContent = item.textContent;
            
            // Close dropdown
            btn.classList.remove('active');
            menu.classList.remove('active');
          });
        });
      });

      // Close dropdowns when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
          document.querySelectorAll('.custom-dropdown .dropdown-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.nextElementSibling.classList.remove('active');
          });
        }
      });
    </script>

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
      const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

      if (mobileMenuToggle && mobileMenuOverlay) {
        mobileMenuToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          mobileMenuToggle.classList.toggle('active');
          mobileMenuOverlay.classList.toggle('active');
          document.body.style.overflow = mobileMenuOverlay.classList.contains('active') ? 'hidden' : '';
        });

        const navLinks = mobileMenuOverlay.querySelectorAll('.nav a, .header-actions a, .header-actions .btn');
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
          });
        });

        document.addEventListener('click', (e) => {
          if (!mobileMenuOverlay.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
          }
        });

        const signupTriggerMobile = document.getElementById('signup-trigger-mobile');
        if (signupTriggerMobile) {
          signupTriggerMobile.addEventListener('click', (e) => {
            e.preventDefault();
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.style.overflow = '';
            const signupTrigger = document.getElementById('signup-trigger');
            if (signupTrigger) {
              signupTrigger.click();
            }
          });
        }
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
