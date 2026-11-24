<?php
// Logout handler: clear the session completely and return the user to the login page.
session_start();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();
if (is_file(__DIR__ . '/frontend-react/dist/index.html')) {
    header('Location: index.php#/login');
} else {
    header('Location: login.php');
}
exit;
