<?php
// Shared PostgreSQL connection and session helper for the MAVORYI PHP auth flow.
// This file is included by every page so all auth pages share the same secure PDO setup.
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$host = 'localhost';
$port = 5432;
$dbName = 'mavoryi';
$dbUser = 'postgres';
$dbPass = 'postgres';

if (!extension_loaded('pdo_pgsql')) {
    die('The PHP PostgreSQL driver (pdo_pgsql) is not enabled. Enable it in your php.ini file and restart Apache.');
}

try {
    // Use PDO with prepared statements and exception-based errors for safe database interaction.
    $pdo = new PDO(
        'pgsql:host=' . $host . ';port=' . $port . ';dbname=' . $dbName,
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    // Helpful message when PostgreSQL is not running or the database has not been created yet.
    die('Database connection failed. Please start PostgreSQL and create the mavoryi database, or update the credentials in db.php.');
}

// Return the currently authenticated user from the PHP session.
function currentUser()
{
    return $_SESSION['user'] ?? null;
}
