<?php

session_start();
$userName = $_SESSION["user_name"] ?? null;
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Time2Go - Platforma flexibila de recrutare</title>
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
        <?php if ($userName): ?>
          <div class="header-actions">
            <div class="lang-switch">
              <button class="lang-btn" type="button">RO ▾</button>
              <div class="lang-menu">
                <a href="#" aria-label="Romanian">RO</a>
                <a href="#" aria-label="English">EN</a>
                <a href="#" aria-label="Russian">RU</a>
              </div>
            </div>
            <a class="btn btn-signup" href="dashboard.php">
              Salut, <?php echo htmlspecialchars($userName); ?>
            </a>
            <a class="btn btn-signin" href="logout.php">Logout</a>
          </div>
        <?php else: ?>
          <div class="header-actions">
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
          </div>
        <?php endif; ?>
        <div class="mobile-menu-overlay">
          <?php if ($userName): ?>
            <div class="header-actions">
              <a class="btn btn-signup" href="dashboard.php">
                Salut, <?php echo htmlspecialchars($userName); ?>
              </a>
              <a class="btn btn-signin" href="logout.php">Logout</a>
              <div class="lang-switch">
                <button class="lang-btn" type="button">RO ▾</button>
                <div class="lang-menu">
                  <a href="#" aria-label="Romanian">RO</a>
                  <a href="#" aria-label="English">EN</a>
                  <a href="#" aria-label="Russian">RU</a>
                </div>
              </div>
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
      <section class="glass-band">
        <div class="hero">
          <div class="container hero-grid">
            <div class="hero-content">
              <p class="eyebrow">Platforma digitala de matching</p>
              <h1>Time2Go</h1>
              <p class="lead">
                Time2Go este o platforma moderna de recrutare si angajare flexibila,
                dedicata sectorului ospitalitatii si serviciilor din Moldova.
              </p>
              <div class="hero-actions">
                <a class="btn btn-primary" href="ce-este.php">Vezi detalii</a>
                <a class="btn btn-secondary" href="cum-functioneaza.php">Cum functioneaza</a>
              </div>
            </div>
            <div class="hero-right">
              <div class="hero-illustration">
                <img src="Illustration/White human coffe.png" alt="Ilustratie Time2Go" />
                <div class="hero-hand-item">
                  <div class="hand-card">
                    <div class="hand-card-icon">💼</div>
                    <div class="hand-card-text">
                      <span class="hand-card-title">Joburi</span>
                      <span class="hand-card-subtitle">Disponibile</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="container">
          <h2>De ce Time2Go?</h2>
          <p class="lead" style="text-align: center; margin-bottom: 48px;">
            Platforma care transforma recrutarea si angajarea in procese rapide, digitale si eficiente.
          </p>
          <div class="feature-grid-new">
            <div class="feature feature-primary">
              <div class="feature-icon">
                <img src="Illustration/MobileIcon.png" alt="Plata in 48h" />
              </div>
              <h3>Plata in 48h</h3>
              <p>Primesti salariul rapid, fara asteptari lungi sau birocratie.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">
                <img src="Illustration/BancCardIcon.png" alt="100% Digital" />
              </div>
              <h3>100% Digital</h3>
              <p>Totul se intampla online, de la aplicare pana la plata.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🎯</div>
              <h3>Matching inteligent</h3>
              <p>Gasesti joburi care se potrivesc perfect cu abilitatile tale.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🔄</div>
              <h3>Flexibilitate totala</h3>
              <p>Lucrezi cand vrei, unde vrei, cat vrei.</p>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="split" style="align-items: center; gap: 48px;">
            <div>
              <h2>Cum functioneaza Time2Go</h2>
              <p style="color: #4d5874; margin: 20px 0; line-height: 1.8;">
                Procesul este simplu si rapid. In cateva minute poti crea un profil, aplica la joburi
                si incepe sa lucrezi. Fara hartii, fara interviuri lungi, fara asteptari.
              </p>
              <div class="steps" style="margin-top: 32px;">
                <div class="step">
                  <span class="step-index">1</span>
                  <h3>Creeaza profilul</h3>
                  <p>Adauga abilitatile, experienta si preferintele tale.</p>
                </div>
                <div class="step">
                  <span class="step-index">2</span>
                  <h3>Aplica la joburi</h3>
                  <p>Browseaza si aplica la joburi care se potrivesc cu tine.</p>
                </div>
                <div class="step">
                  <span class="step-index">3</span>
                  <h3>Lucreaza si primeste plata</h3>
                  <p>Accepta jobul, lucreaza si primeste plata in 48h.</p>
                </div>
              </div>
            </div>
            <div style="position: relative; margin-top: 80px;">
              <img src="Illustration/Colleagues sharing laptop screen, Teamwork and collaboration, Digital project review.png" alt="Colleagues sharing laptop screen, Teamwork and collaboration, Digital project review" style="width: 100%; border-radius: 24px; box-shadow: 0 20px 40px rgba(66, 50, 120, 0.15); object-fit: cover;" />
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <h2 style="text-align: center; margin-bottom: 16px; font-size: 2.5rem; font-weight: 700; color: #1e1c2f;">Ce spun utilizatorii nostri</h2>
          <p style="text-align: center; color: #6b748a; margin-bottom: 56px; font-size: 1.1rem;">
            Mii de persoane folosesc deja Time2Go pentru joburi flexibile
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 32px;">
            <div class="testimonial-card" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 40px; border-radius: 32px; border: 2px solid rgba(224, 216, 247, 0.6); box-shadow: 0 20px 50px rgba(66, 50, 120, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8); text-align: center; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: visible;">
              <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, #7a63f1, #9d7bff); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 5px solid rgba(255, 255, 255, 0.95); box-shadow: 0 12px 28px rgba(122, 99, 241, 0.25); z-index: 2;">
                <img src="Illustration/AvatarWhiteGirl.png" alt="Maria P." style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="margin-top: 50px;">
                <div style="font-size: 3rem; color: rgba(122, 99, 241, 0.15); line-height: 1; margin-bottom: 20px; font-family: Georgia, serif;">"</div>
                <p style="color: #1e1c2f; font-style: italic; margin: 0 0 24px 0; line-height: 1.9; font-size: 1.08rem; font-weight: 400;">
                  Time2Go mi-a schimbat viata! Acum pot lucra cand vreau si primesc plata rapid. Perfect pentru studenti!
                </p>
                <div style="padding-top: 20px; border-top: 2px solid rgba(224, 216, 247, 0.5); position: relative;">
                  <div style="position: absolute; top: -2px; left: 50%; transform: translateX(-50%); width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #7a63f1, transparent);"></div>
                  <p style="color: #7a63f1; font-weight: 700; font-size: 1.15rem; margin: 0 0 4px 0;">Maria P.</p>
                  <p style="color: #9a8bc4; font-size: 0.95rem; margin: 0; font-weight: 500;">Student</p>
                </div>
              </div>
            </div>
            <div class="testimonial-card" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 40px; border-radius: 32px; border: 2px solid rgba(224, 216, 247, 0.6); box-shadow: 0 20px 50px rgba(66, 50, 120, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8); text-align: center; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: visible;">
              <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, #7a63f1, #9d7bff); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 5px solid rgba(255, 255, 255, 0.95); box-shadow: 0 12px 28px rgba(122, 99, 241, 0.25); z-index: 2;">
                <img src="Illustration/AvatarWhiteGuy.png" alt="Ion D." style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="margin-top: 50px;">
                <div style="font-size: 3rem; color: rgba(122, 99, 241, 0.15); line-height: 1; margin-bottom: 20px; font-family: Georgia, serif;">"</div>
                <p style="color: #1e1c2f; font-style: italic; margin: 0 0 24px 0; line-height: 1.9; font-size: 1.08rem; font-weight: 400;">
                  Ca angajator, Time2Go m-a ajutat sa gasesc personal calificat rapid si fara costuri ascunse. Recomand!
                </p>
                <div style="padding-top: 20px; border-top: 2px solid rgba(224, 216, 247, 0.5); position: relative;">
                  <div style="position: absolute; top: -2px; left: 50%; transform: translateX(-50%); width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #7a63f1, transparent);"></div>
                  <p style="color: #7a63f1; font-weight: 700; font-size: 1.15rem; margin: 0 0 4px 0;">Ion D.</p>
                  <p style="color: #9a8bc4; font-size: 0.95rem; margin: 0; font-weight: 500;">Manager Restaurant</p>
                </div>
              </div>
            </div>
            <div class="testimonial-card" style="background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); padding: 40px; border-radius: 32px; border: 2px solid rgba(224, 216, 247, 0.6); box-shadow: 0 20px 50px rgba(66, 50, 120, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8); text-align: center; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: visible;">
              <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 90px; height: 90px; border-radius: 50%; background: linear-gradient(135deg, #7a63f1, #9d7bff); display: flex; align-items: center; justify-content: center; overflow: hidden; border: 5px solid rgba(255, 255, 255, 0.95); box-shadow: 0 12px 28px rgba(122, 99, 241, 0.25); z-index: 2;">
                <img src="Illustration/AvatarWhiteGirl2.png" alt="Ana M." style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="margin-top: 50px;">
                <div style="font-size: 3rem; color: rgba(122, 99, 241, 0.15); line-height: 1; margin-bottom: 20px; font-family: Georgia, serif;">"</div>
                <p style="color: #1e1c2f; font-style: italic; margin: 0 0 24px 0; line-height: 1.9; font-size: 1.08rem; font-weight: 400;">
                  Platforma este intuitiva si usor de folosit. Am gasit joburi part-time perfecte pentru programul meu.
                </p>
                <div style="padding-top: 20px; border-top: 2px solid rgba(224, 216, 247, 0.5); position: relative;">
                  <div style="position: absolute; top: -2px; left: 50%; transform: translateX(-50%); width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #7a63f1, transparent);"></div>
                  <p style="color: #7a63f1; font-weight: 700; font-size: 1.15rem; margin: 0 0 4px 0;">Ana M.</p>
                  <p style="color: #9a8bc4; font-size: 0.95rem; margin: 0; font-weight: 500;">Freelancer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section alt phone-section">
        <div class="container">
          <div class="phone-stack-container" style="position: relative; width: 100%; min-height: 800px; display: flex; align-items: center; justify-content: center; overflow: visible;">
            <img src="Illustration/Screenshot-iPhone15 Pro Max.png" alt="iPhone 15 Pro Max" class="phone-main" style="position: relative; z-index: 2; width: auto; height: 700px; max-width: none; object-fit: contain;" />
            <img src="Illustration/Screenshot-iPhone1321.png" alt="iPhone 13" class="phone-behind phone-left" style="position: absolute; z-index: 1; left: 50%; transform: translateX(-50%) rotate(-5deg) translateY(20px); width: auto; height: 650px; max-width: none; object-fit: contain; opacity: 0;" />
            <img src="Illustration/Screenshot-iPhone1321.png" alt="iPhone 13" class="phone-behind phone-right" style="position: absolute; z-index: 1; left: 50%; transform: translateX(-50%) rotate(5deg) translateY(20px); width: auto; height: 650px; max-width: none; object-fit: contain; opacity: 0;" />
          </div>
        </div>
      </section>

      <section class="section cta">
        <div class="container">
          <h2>Gata sa incepi?</h2>
          <p style="margin: 20px 0 32px; color: #4d5874;">
            Alatura-te mii de persoane care folosesc deja Time2Go pentru joburi flexibile si recrutare rapida.
          </p>
          <div class="cta-actions">
            <a class="btn btn-primary" href="#" id="signup-trigger-cta">Creeaza cont gratuit</a>
            <a class="btn btn-secondary" href="find-jobs.php">Vezi joburi disponibile</a>
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

        // Animate hero card if it exists
        const heroCard = document.querySelector('.hero-right .hero-card');
        if (heroCard) {
          const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                cardObserver.unobserve(entry.target);
              }
            });
          }, { threshold: 0.1 });
          cardObserver.observe(heroCard);
        }

        // Animate feature cards
        const features = document.querySelectorAll('.feature');
        features.forEach((feature, index) => {
          const featureObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.style.animationDelay = `${index * 0.1}s`;
                entry.target.classList.add('animate-in');
                featureObserver.unobserve(entry.target);
              }
            });
          }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          });
          featureObserver.observe(feature);
        });

        // Animate steps
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
          const stepObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.style.animationDelay = `${index * 0.1}s`;
                entry.target.classList.add('animate-in');
                stepObserver.unobserve(entry.target);
              }
            });
          }, { 
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          });
          stepObserver.observe(step);
        });

        // Animate phone section
        const phoneSection = document.querySelector('.phone-section');
        if (phoneSection) {
          const phoneObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                entry.target.classList.add('animate-phones');
                phoneObserver.unobserve(entry.target);
              }
            });
          }, { 
            threshold: 0.2,
            rootMargin: '0px 0px -100px 0px'
          });
          phoneObserver.observe(phoneSection);
        }
      }

      // Initialize scroll animations
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollAnimations);
      } else {
        initScrollAnimations();
      }

      // Modal functionality
      const signupTriggers = document.querySelectorAll('#signup-trigger, #signup-trigger-cta');
      const modal = document.getElementById('roleModal');
      const closeModal = document.getElementById('closeModal');
      const roleOptions = document.querySelectorAll('.role-option');

      // Open modal
      signupTriggers.forEach(trigger => {
        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        });
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

      // Mobile menu toggle - must run after DOM is ready
      function initMobileMenu() {
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');

        if (!mobileMenuToggle || !mobileMenuOverlay) {
          return;
        }

        // Toggle menu
        mobileMenuToggle.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const isActive = mobileMenuOverlay.classList.contains('active');
          
          if (isActive) {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
            document.body.style.overflow = '';
          } else {
            mobileMenuToggle.classList.add('active');
            mobileMenuOverlay.classList.add('active');
            document.body.classList.add('mobile-menu-open');
            document.body.style.overflow = 'hidden';
          }
        });

        // Close menu when clicking on a link
        const navLinks = mobileMenuOverlay.querySelectorAll('a, button');
        navLinks.forEach(function(link) {
          link.addEventListener('click', function(e) {
            // Don't close if it's a dropdown button
            if (link.classList.contains('lang-btn') || link.classList.contains('dropdown-btn')) {
              return;
            }
            
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
            document.body.style.overflow = '';
          });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
          if (mobileMenuOverlay.classList.contains('active')) {
            if (!mobileMenuOverlay.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
              mobileMenuToggle.classList.remove('active');
              mobileMenuOverlay.classList.remove('active');
              document.body.classList.remove('mobile-menu-open');
              document.body.style.overflow = '';
            }
          }
        });

        // Handle Sign Up trigger in mobile menu
        const signupTriggerMobile = document.getElementById('signup-trigger-mobile');
        if (signupTriggerMobile) {
          signupTriggerMobile.addEventListener('click', function(e) {
            e.preventDefault();
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
            document.body.style.overflow = '';
            
            setTimeout(function() {
              const signupTrigger = document.getElementById('signup-trigger');
              if (signupTrigger) {
                signupTrigger.click();
              }
            }, 100);
          });
        }

        // Close on escape key
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && mobileMenuOverlay.classList.contains('active')) {
            mobileMenuToggle.classList.remove('active');
            mobileMenuOverlay.classList.remove('active');
            document.body.classList.remove('mobile-menu-open');
            document.body.style.overflow = '';
          }
        });
      }

      // Initialize when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileMenu);
      } else {
        initMobileMenu();
      }

      // Scroll effect for purple section - smooth transition
      function initScrollPurple() {
        const purpleSection = document.getElementById('scroll-purple-section');
        if (!purpleSection) return;

        let lastScrollTop = 0;
        let scrollProgress = 0;
        let rafId = null;

        function updateScrollProgress() {
          const rect = purpleSection.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const sectionHeight = rect.height;
          
          // Calculate progress based on scroll position within section
          let progress = 0;
          
          if (rect.top < windowHeight && rect.bottom > 0) {
            // Section is in view
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const sectionTop = scrollTop + rect.top - windowHeight;
            const scrollDistance = scrollTop - sectionTop;
            const maxScroll = sectionHeight + windowHeight;
            
            progress = Math.max(0, Math.min(1, scrollDistance / maxScroll));
          }
          
          // Smooth interpolation
          scrollProgress += (progress - scrollProgress) * 0.1;
          
          purpleSection.style.setProperty('--scroll-progress', scrollProgress);
          
          if (scrollProgress > 0.2) {
            purpleSection.classList.add('scrolled');
          } else {
            purpleSection.classList.remove('scrolled');
          }
          
          rafId = null;
        }

        function handleScroll() {
          if (!rafId) {
            rafId = requestAnimationFrame(updateScrollProgress);
          }
        }

        window.addEventListener('scroll', handleScroll, { passive: true });
        updateScrollProgress(); // Initial check
      }

      // Initialize scroll purple effect
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initScrollPurple);
      } else {
        initScrollPurple();
      }

      // Animate purple section on scroll into view
      function initPurpleSectionAnimation() {
        const purpleSection = document.getElementById('scroll-purple-section');
        if (!purpleSection) return;

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              purpleSection.classList.add('animate-in');
              observer.unobserve(purpleSection);
            }
          });
        }, {
          threshold: 0.1,
          rootMargin: '0px'
        });

        observer.observe(purpleSection);
      }

      // Initialize purple section animation
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPurpleSectionAnimation);
      } else {
        initPurpleSectionAnimation();
      }
    </script>
  </body>
</html>
