<?php

session_start();

if (!isset($_SESSION["user_id"])) {
  header("Location: login.php");
  exit;
}

$name = $_SESSION["user_name"] ?? "Utilizator";
?>
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Work2Now - Dashboard</title>
    <link rel="stylesheet" href="dashboard.css" />
  </head>
  <body class="dashboard-body">
    <div class="dashboard">
      <aside class="sidebar">
        <div class="brand">
          <img src="LogoWork2Now.png" alt="Work2Now" />
          <span>Work2Now</span>
        </div>

        <button class="primary-btn">+ Posteaza un job</button>

        <nav class="nav">
          <a class="nav-item active" href="#">Home</a>
          <a class="nav-item" href="#">Joburi</a>
          <a class="nav-item" href="#">Aplicatii</a>
          <a class="nav-item" href="#">Rapoarte</a>
          <a class="nav-item" href="#">Calendar</a>
          <a class="nav-item" href="#">Mesaje</a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-card">
            <img src="Illustration/AvatarWhiteGuy.png" alt="Avatar" />
            <div>
              <p class="user-name"><?php echo htmlspecialchars($name); ?></p>
              <span class="user-role">Manager</span>
            </div>
          </div>
          <a class="logout" href="logout.php">Logout</a>
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <h1>Hello, <?php echo htmlspecialchars($name); ?></h1>
            <p>Hai sa vedem statusul pentru azi.</p>
          </div>
          <div class="topbar-actions">
            <input type="search" placeholder="Cauta joburi, persoane..." />
            <button class="ghost-btn">+ Creeaza</button>
            <div class="notify">3</div>
          </div>
        </header>

        <section class="stats-grid">
          <article class="stat-card">
            <h3>Aplicatii</h3>
            <p class="stat-value">32</p>
            <span class="stat-meta">+8 azi</span>
          </article>
          <article class="stat-card">
            <h3>Check-in & Check-out</h3>
            <p class="stat-value">14</p>
            <span class="stat-meta">2 intarzieri</span>
          </article>
          <article class="stat-card">
            <h3>Rating</h3>
            <p class="stat-value">4.8</p>
            <span class="stat-meta">Din 120 recenzii</span>
          </article>
          <article class="stat-card highlight">
            <h3>Buget</h3>
            <p class="stat-value">€12.4k</p>
            <span class="stat-meta">Disponibil luna asta</span>
          </article>
        </section>

        <section class="content-grid">
          <div class="panel jobs">
            <div class="panel-header">
              <h2>Joburile de azi</h2>
              <button class="ghost-btn small">+ Job nou</button>
            </div>
            <div class="table">
              <div class="table-row header">
                <span>Job</span>
                <span>Locatie</span>
                <span>Status</span>
                <span>Data</span>
              </div>
              <div class="table-row">
                <span>Barista</span>
                <span>Chisinau</span>
                <span class="tag success">Confirmat</span>
                <span>Astazi</span>
              </div>
              <div class="table-row">
                <span>Receptioner</span>
                <span>Bucuresti</span>
                <span class="tag warning">In asteptare</span>
                <span>Astazi</span>
              </div>
              <div class="table-row">
                <span>Housekeeping</span>
                <span>Cluj</span>
                <span class="tag neutral">Draft</span>
                <span>Maine</span>
              </div>
            </div>
          </div>

          <div class="panel activity">
            <div class="panel-header">
              <h2>Activitate</h2>
              <div class="segmented">
                <button class="active">Saptamana</button>
                <button>Luna</button>
                <button>An</button>
              </div>
            </div>
            <div class="chart">
              <div class="bar" style="height: 40%"></div>
              <div class="bar" style="height: 65%"></div>
              <div class="bar" style="height: 55%"></div>
              <div class="bar" style="height: 80%"></div>
              <div class="bar" style="height: 50%"></div>
              <div class="bar" style="height: 70%"></div>
              <div class="bar" style="height: 60%"></div>
            </div>
          </div>

          <div class="panel quick">
            <h2>Quick actions</h2>
            <div class="quick-grid">
              <button>Adauga job</button>
              <button>Invite staff</button>
              <button>Genereaza raport</button>
              <button>Setari echipa</button>
            </div>
          </div>

          <div class="panel candidates">
            <div class="panel-header">
              <h2>Candidati recomandati</h2>
              <a href="#" class="link">Vezi tot</a>
            </div>
            <div class="candidate">
              <img src="Illustration/AvatarWhiteGirl.png" alt="Avatar" />
              <div>
                <p>Maria Popa</p>
                <span>Hospitality · 5 ani</span>
              </div>
              <button class="ghost-btn small">Invita</button>
            </div>
            <div class="candidate">
              <img src="Illustration/AvatarBlackGuy.png" alt="Avatar" />
              <div>
                <p>David Ionescu</p>
                <span>Barista · 3 ani</span>
              </div>
              <button class="ghost-btn small">Invita</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>
