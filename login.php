<?php
if (is_file(__DIR__ . '/frontend-react/dist/index.html')) {
    header('Location: index.php#/login');
    exit;
}

// Login page: validates email/password and signs the user into the PHP session.
require __DIR__ . '/db.php';

$pageTitle = 'Login | MAVORYI';

if (currentUser()) {
    header('Location: profile.php');
    exit;
}

$errorMessage = '';
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Normalize the submitted email before checking it against the database.
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errorMessage = 'Please enter a valid email address.';
    } elseif ($password === '') {
        $errorMessage = 'Please enter your password.';
    } else {
        // Look up the user with a prepared statement and verify the hash with password_verify().
        $statement = $pdo->prepare('SELECT id, name, email, password, created_at FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();

        if ($user && password_verify($password, $user['password'])) {
            session_regenerate_id(true);
            $_SESSION['user'] = [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'created_at' => $user['created_at'],
            ];

            header('Location: profile.php');
            exit;
        }

        $errorMessage = 'Invalid email or password';
    }
}

require __DIR__ . '/header.php';
?>

<main class="page-shell">
    <section class="auth-panel">
        <div class="eyebrow">Welcome back</div>
        <h2>Login to your Mavoryi account</h2>
        <p>Access your profile, saved preferences, and premium member features.</p>

        <?php if ($errorMessage !== ''): ?>
            <div class="error-message"><?php echo htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <form method="post" class="form-grid" novalidate>
            <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="<?php echo htmlspecialchars($email, ENT_QUOTES, 'UTF-8'); ?>" placeholder="you@example.com" required>
            </div>

            <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" placeholder="Enter your password" required>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-solid">Login</button>
                <a href="signup.php" class="auth-link">Don't have an account? Sign up</a>
            </div>
        </form>
    </section>
</main>
