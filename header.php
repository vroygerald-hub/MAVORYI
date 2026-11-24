<?php
// Reusable page shell for the MAVORYI website.
// It handles the nav bar state automatically based on whether the visitor is logged in.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$currentUser = $_SESSION['user'] ?? null;
$currentPage = basename($_SERVER['PHP_SELF']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo isset($pageTitle) ? htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') : 'MAVORYI'; ?></title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <!-- Header styling changes depending on login state so guests and logged-in users feel visually different. -->
    <header class="site-header <?php echo $currentUser ? 'header-logged-in' : 'header-logged-out'; ?>">
        <div class="container nav-wrap">
            <a href="index.php" class="brand-wrap" aria-label="MAVORYI home page">
                <span class="brand-mark">M</span>
                <span class="brand-name">MAVORYI</span>
            </a>

            <nav class="main-nav" aria-label="Main navigation">
                <a href="index.php" class="nav-link <?php echo $currentPage === 'index.php' ? 'active' : ''; ?>">Home</a>
                <a href="profile.php" class="nav-link <?php echo $currentPage === 'profile.php' ? 'active' : ''; ?>">Profile</a>
            </nav>

            <?php if ($currentUser): ?>
                <!-- Logged-in state: show quick access to the member profile and logout actions. -->
                <div class="user-menu">
                    <div class="user-badge">
                        <span class="avatar-mini"><?php echo strtoupper(substr($currentUser['name'], 0, 1)); ?></span>
                        <div>
                            <strong><?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></strong>
                            <small>Logged in as <?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></small>
                        </div>
                    </div>
                    <a href="profile.php" class="btn btn-light">My Profile</a>
                    <a href="logout.php" class="btn btn-outline">Logout</a>
                </div>
            <?php else: ?>
                <!-- Logged-out state: show a clean, premium call-to-action for account access. -->
                <div class="auth-actions">
                    <a href="login.php" class="btn btn-outline">Login</a>
                    <a href="signup.php" class="btn btn-solid">Sign Up</a>
                </div>
            <?php endif; ?>
        </div>
    </header>
