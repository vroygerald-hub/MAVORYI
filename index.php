<?php
// Serve the built React storefront from this PHP entry point so it shares the PHP session and auth API.
$reactEntryPath = __DIR__ . '/frontend-react/dist/index.html';
if (is_file($reactEntryPath) && is_readable($reactEntryPath)) {
    $reactEntry = file_get_contents($reactEntryPath);
    $reactEntry = preg_replace('/<head>/', '<head><base href="./frontend-react/dist/">', $reactEntry, 1, $baseTagCount);

    if ($reactEntry === null || $baseTagCount !== 1) {
        http_response_code(500);
        exit('The React storefront build is invalid. Rebuild the frontend and try again.');
    }

    header('Content-Type: text/html; charset=utf-8');
    echo $reactEntry;
    exit;
}

// Homepage for the MAVORYI storefront and member experience.
// It checks whether the user is logged in and swaps the banner and CTA content accordingly.
require __DIR__ . '/db.php';

$pageTitle = 'MAVORYI | Modern Luxury Essentials';
$currentUser = currentUser();

require __DIR__ . '/header.php';
?>

<main class="page-shell">
    <section class="hero">
        <div>
            <span class="eyebrow">Luxury living</span>
            <h1>Discover elevated essentials for the modern wardrobe.</h1>
            <p>Premium quality, timeless silhouettes, and curated pieces designed for the everyday icon. Mavoryi brings effortless expression to every day.</p>
            <div class="hero-actions">
                <?php if ($currentUser): ?>
                    <a href="profile.php" class="btn btn-solid">View my profile</a>
                    <a href="logout.php" class="btn btn-outline">Logout</a>
                <?php else: ?>
                    <a href="signup.php" class="btn btn-solid">Join Mavoryi</a>
                    <a href="login.php" class="btn btn-outline">Login</a>
                <?php endif; ?>
            </div>
        </div>

        <div class="feature-card">
            <div class="eyebrow">Curated by design</div>
            <h3>Built for confidence</h3>
            <p>From standout staples to modern statement pieces, every product is selected to refine your style and elevate your routine.</p>
        </div>
    </section>

    <?php if ($currentUser): ?>
        <div class="notice-box logged-in">
            <div>
                <strong>Logged in as <?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></strong>
                <p>Welcome back. Your Mavoryi account unlocks exclusive access and a smoother shopping experience.</p>
            </div>
            <a href="profile.php" class="btn btn-outline">My Profile</a>
        </div>
    <?php else: ?>
        <div class="notice-box">
            <div>
                <strong>Join Mavoryi</strong>
                <p>Login to unlock exclusive access, member-only picks, and a personalized shopping experience.</p>
            </div>
            <a href="login.php" class="btn btn-solid">Login to Continue</a>
        </div>
    <?php endif; ?>

    <section class="feature-grid">
        <article class="feature-card">
            <div class="eyebrow">01</div>
            <h3>Curated Collections</h3>
            <p>Thoughtful pieces selected around elegance, comfort, and standout craftsmanship.</p>
        </article>

        <article class="feature-card">
            <div class="eyebrow">02</div>
            <h3>Premium Quality</h3>
            <p>Every item is chosen for refined detailing, premium comfort, and lasting value.</p>
        </article>

        <article class="feature-card">
            <div class="eyebrow">03</div>
            <h3>Member Benefits</h3>
            <p>Access personalized recommendations and a seamless logged-in account experience.</p>
        </article>
    </section>
</main>
