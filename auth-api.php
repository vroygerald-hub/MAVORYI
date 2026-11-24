<?php
// JSON endpoints shared by the React storefront and the existing PHP account pages.
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');

function authApiRespond($status, array $payload)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function authApiPublicUser(array $user)
{
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'created_at' => $user['created_at'],
    ];
}

function authApiClearSession()
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $cookie = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $cookie['path'],
            $cookie['domain'],
            $cookie['secure'],
            $cookie['httponly']
        );
    }

    session_destroy();
}

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'session') {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }

    authApiRespond(200, [
        'user' => currentUser(),
        'csrfToken' => $_SESSION['csrf_token'],
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    authApiRespond(405, ['error' => 'This account action is not supported.']);
}

$sessionToken = $_SESSION['csrf_token'] ?? '';
$requestToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
if ($sessionToken === '' || $requestToken === '' || !hash_equals($sessionToken, $requestToken)) {
    authApiRespond(403, ['error' => 'Your session expired. Refresh the page and try again.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    authApiRespond(400, ['error' => 'Please submit valid account details.']);
}

if ($action === 'login') {
    $emailInput = $input['email'] ?? '';
    $passwordInput = $input['password'] ?? '';
    $email = is_string($emailInput) ? strtolower(trim($emailInput)) : '';
    $password = is_string($passwordInput) ? $passwordInput : '';
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        authApiRespond(422, ['error' => 'Please enter a valid email address and password.']);
    }

    try {
        $statement = $pdo->prepare('SELECT id, name, email, password, created_at FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();
    } catch (PDOException $error) {
        error_log('MAVORYI account login failed: ' . $error->getMessage());
        authApiRespond(500, ['error' => 'The account database is unavailable. Check the PostgreSQL settings and users table.']);
    }
    if (!$user || !password_verify($password, $user['password'])) {
        authApiRespond(401, ['error' => 'Invalid email or password.']);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = authApiPublicUser($user);
    authApiRespond(200, ['user' => $_SESSION['user'], 'csrfToken' => $_SESSION['csrf_token']]);
}

if ($action === 'signup') {
    $nameInput = $input['name'] ?? '';
    $emailInput = $input['email'] ?? '';
    $passwordInput = $input['password'] ?? '';
    $confirmPasswordInput = $input['confirmPassword'] ?? ($input['confirm_password'] ?? '');
    $name = is_string($nameInput) ? trim($nameInput) : '';
    $email = is_string($emailInput) ? strtolower(trim($emailInput)) : '';
    $password = is_string($passwordInput) ? $passwordInput : '';
    $confirmPassword = is_string($confirmPasswordInput) ? $confirmPasswordInput : '';

    if ($name === '' || strlen($name) > 120) {
        authApiRespond(422, ['error' => 'Please enter your name (up to 120 characters).']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        authApiRespond(422, ['error' => 'Please enter a valid email address.']);
    }
    if (strlen($password) < 8) {
        authApiRespond(422, ['error' => 'Password must be at least 8 characters long.']);
    }
    if ($password !== $confirmPassword) {
        authApiRespond(422, ['error' => 'Passwords do not match.']);
    }

    try {
        $checkUser = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
        $checkUser->execute(['email' => $email]);
    } catch (PDOException $error) {
        error_log('MAVORYI signup check failed: ' . $error->getMessage());
        authApiRespond(500, ['error' => 'The account database is unavailable. Check the PostgreSQL settings and users table.']);
    }
    if ($checkUser->fetch()) {
        authApiRespond(409, ['error' => 'This email is already registered.']);
    }

    try {
        $insertUser = $pdo->prepare(
            'INSERT INTO users (name, email, password) VALUES (:name, :email, :password) RETURNING id, name, email, created_at'
        );
        $insertUser->execute([
            'name' => $name,
            'email' => $email,
            'password' => password_hash($password, PASSWORD_DEFAULT),
        ]);
        $user = $insertUser->fetch();
    } catch (PDOException $error) {
        if ($error->getCode() === '23505') {
            authApiRespond(409, ['error' => 'This email is already registered.']);
        }
        error_log('MAVORYI account signup failed: ' . $error->getMessage());
        authApiRespond(500, ['error' => 'Your account could not be created right now. Please try again.']);
    }

    session_regenerate_id(true);
    $_SESSION['user'] = authApiPublicUser($user);
    authApiRespond(201, ['user' => $_SESSION['user'], 'csrfToken' => $_SESSION['csrf_token']]);
}

if ($action === 'profile') {
    $currentUser = currentUser();
    if (!$currentUser) {
        authApiRespond(401, ['error' => 'Please log in to update your profile.']);
    }

    $nameInput = $input['name'] ?? '';
    $emailInput = $input['email'] ?? '';
    $name = is_string($nameInput) ? trim($nameInput) : '';
    $email = is_string($emailInput) ? strtolower(trim($emailInput)) : '';
    if ($name === '' || strlen($name) > 120) {
        authApiRespond(422, ['error' => 'Please enter your name (up to 120 characters).']);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        authApiRespond(422, ['error' => 'Please enter a valid email address.']);
    }

    try {
        $checkEmail = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
        $checkEmail->execute(['email' => $email, 'id' => $currentUser['id']]);
    } catch (PDOException $error) {
        error_log('MAVORYI profile email check failed: ' . $error->getMessage());
        authApiRespond(500, ['error' => 'The account database is unavailable. Check the PostgreSQL settings and users table.']);
    }
    if ($checkEmail->fetch()) {
        authApiRespond(409, ['error' => 'This email is already in use by another account.']);
    }

    try {
        $updateUser = $pdo->prepare(
            'UPDATE users SET name = :name, email = :email WHERE id = :id RETURNING id, name, email, created_at'
        );
        $updateUser->execute(['name' => $name, 'email' => $email, 'id' => $currentUser['id']]);
        $user = $updateUser->fetch();
    } catch (PDOException $error) {
        if ($error->getCode() === '23505') {
            authApiRespond(409, ['error' => 'This email is already in use by another account.']);
        }
        error_log('MAVORYI profile update failed: ' . $error->getMessage());
        authApiRespond(500, ['error' => 'Your profile could not be updated right now. Please try again.']);
    }

    $_SESSION['user'] = authApiPublicUser($user);
    authApiRespond(200, ['user' => $_SESSION['user'], 'csrfToken' => $_SESSION['csrf_token']]);
}

if ($action === 'logout') {
    authApiClearSession();
    authApiRespond(200, ['user' => null]);
}

authApiRespond(404, ['error' => 'Account action not found.']);
