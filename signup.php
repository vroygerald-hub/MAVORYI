<?php
if (is_file(__DIR__ . '/frontend-react/dist/index.html')) {
    header('Location: index.php#/signup');
    exit;
}

// Signup page: creates a new user securely, hashes the password, logs in immediately, and redirects to the profile.
require __DIR__ . '/db.php';

$pageTitle = 'Create account | MAVORYI';

if (currentUser()) {
    header('Location: profile.php');
    exit;
}

$errors = [];
$formData = [
    'name' => '',
    'email' => '',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Capture the submitted values and normalize them before validation.
    $formData['name'] = trim($_POST['name'] ?? '');
    $formData['email'] = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if ($formData['name'] === '') {
        $errors[] = 'Full name is required.';
    }

    if ($formData['email'] === '' || !filter_var($formData['email'], FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Please enter a valid email address.';
    }

    if (strlen($password) < 8) {
        $errors[] = 'Password must be at least 8 characters long.';
    }

    if ($password !== $confirmPassword) {
        $errors[] = 'Passwords do not match.';
    }

    // Prevent duplicate accounts by checking the unique email first.
    if (empty($errors) && $formData['email'] !== '') {
        $checkUser = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkUser->execute(['email' => $formData['email']]);

        if ($checkUser->fetch()) {
            $errors[] = 'This email is already registered.';
        }
    }

    if (empty($errors)) {
        // Use password_hash() so raw passwords are never kept in the database.
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $insertUser = $pdo->prepare(
            'INSERT INTO users (name, email, password) VALUES (:name, :email, :password) RETURNING id, name, email, created_at'
        );
        $insertUser->execute([
            'name' => $formData['name'],
            'email' => $formData['email'],
            'password' => $passwordHash,
        ]);
        $user = $insertUser->fetch();
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        header('Location: profile.php');
        exit;
    }
}

require __DIR__ . '/header.php';
?>

<main class="page-shell">
    <section class="auth-panel">
        <div class="eyebrow">Create account</div>
        <h2>Join Mavoryi</h2>
        <p>Sign up to unlock premium access and a more personalized shopping experience.</p>

        <?php if (!empty($errors)): ?>
            <div class="error-message">
                <?php foreach ($errors as $error): ?>
                    <div><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <form method="post" class="form-grid" novalidate>
            <div class="field">
                <label for="name">Full Name</label>
                <input id="name" name="name" type="text" value="<?php echo htmlspecialchars($formData['name'], ENT_QUOTES, 'UTF-8'); ?>" placeholder="Your full name" required>
            </div>

            <div class="field">
                <label for="email">Email</label>
                <input id="email" name="email" type="email" value="<?php echo htmlspecialchars($formData['email'], ENT_QUOTES, 'UTF-8'); ?>" placeholder="you@example.com" required>
            </div>

            <div class="field">
                <label for="password">Password</label>
                <input id="password" name="password" type="password" placeholder="Minimum 8 characters" required>
            </div>

            <div class="field">
                <label for="confirm_password">Confirm Password</label>
                <input id="confirm_password" name="confirm_password" type="password" placeholder="Repeat your password" required>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-solid">Create account</button>
                <a href="login.php" class="auth-link">Already have an account? Login</a>
            </div>
        </form>
    </section>
</main>
