<?php
if (is_file(__DIR__ . '/frontend-react/dist/index.html')) {
    header('Location: index.php#/profile');
    exit;
}

// Profile page: only accessible to logged-in users and allows account details to be viewed and updated.
require __DIR__ . '/db.php';

$pageTitle = 'My Profile | MAVORYI';

$currentUser = currentUser();
if (!$currentUser) {
    header('Location: login.php');
    exit;
}

$profileError = '';
$profileSuccess = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_profile'])) {
    // Handle inline profile updates so the user can update their name or email without coding changes.
    $newName = trim($_POST['name'] ?? '');
    $newEmail = strtolower(trim($_POST['email'] ?? ''));

    if ($newName === '') {
        $profileError = 'Your name cannot be empty.';
    } elseif ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        $profileError = 'Please provide a valid email address.';
    } else {
        $checkEmail = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id != :id LIMIT 1');
        $checkEmail->execute([
            'email' => $newEmail,
            'id' => $currentUser['id'],
        ]);

        if ($checkEmail->fetch()) {
            $profileError = 'This email is already in use by another account.';
        } else {
            $updateUser = $pdo->prepare('UPDATE users SET name = :name, email = :email WHERE id = :id');
            $updateUser->execute([
                'name' => $newName,
                'email' => $newEmail,
                'id' => $currentUser['id'],
            ]);

            // Keep the session in sync with the latest user data.
            $_SESSION['user']['name'] = $newName;
            $_SESSION['user']['email'] = $newEmail;
            $currentUser = $_SESSION['user'];
            $profileSuccess = 'Profile updated successfully.';
        }
    }
}

require __DIR__ . '/header.php';
?>

<main class="page-shell">
    <section class="profile-panel">
        <div class="eyebrow">Member profile</div>
        <h2>Welcome back, <?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></h2>
        <p>Your Mavoryi account is active and ready for a personalized shopping experience.</p>

        <?php if ($profileError !== ''): ?>
            <div class="error-message"><?php echo htmlspecialchars($profileError, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <?php if ($profileSuccess !== ''): ?>
            <div class="success-message"><?php echo htmlspecialchars($profileSuccess, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>

        <div class="profile-summary">
            <div class="profile-avatar"><?php echo strtoupper(substr($currentUser['name'], 0, 1)); ?></div>

            <div class="profile-meta">
                <span class="meta-label">Account status</span>
                <h3><?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></h3>
                <p><?php echo htmlspecialchars($currentUser['email'], ENT_QUOTES, 'UTF-8'); ?></p>
            </div>
        </div>

        <div class="profile-detail-list">
            <div class="detail-item">
                <strong>Member name</strong>
                <span><?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?></span>
            </div>
            <div class="detail-item">
                <strong>Email address</strong>
                <span><?php echo htmlspecialchars($currentUser['email'], ENT_QUOTES, 'UTF-8'); ?></span>
            </div>
            <div class="detail-item">
                <strong>Account created</strong>
                <span><?php echo htmlspecialchars(date('F j, Y', strtotime($currentUser['created_at'] ?? 'now')), ENT_QUOTES, 'UTF-8'); ?></span>
            </div>
        </div>

        <div class="profile-actions">
            <a href="#edit-profile" class="btn btn-solid">Edit Profile</a>
            <a href="logout.php" class="btn btn-outline">Logout</a>
        </div>

        <div class="form-box" id="edit-profile">
            <div class="eyebrow">Update details</div>
            <h3>Edit profile information</h3>
            <form method="post" class="form-grid" novalidate>
                <div class="field">
                    <label for="profile-name">Full Name</label>
                    <input id="profile-name" name="name" type="text" value="<?php echo htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8'); ?>" required>
                </div>

                <div class="field">
                    <label for="profile-email">Email</label>
                    <input id="profile-email" name="email" type="email" value="<?php echo htmlspecialchars($currentUser['email'], ENT_QUOTES, 'UTF-8'); ?>" required>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-solid" name="update_profile" value="1">Save changes</button>
                </div>
            </form>
        </div>
    </section>
</main>
