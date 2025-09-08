const express = require('express');
const {createUser,
    login,
    logout,
    refresh,
    verify,
    getUsers,
    getSingleUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    adminLoginAsUser
} = require('../controllers/authController')

const router = express.Router();

router.post("/createUser",createUser);
router.post("/login",login);
router.post("/login-as-user",adminLoginAsUser);
router.post("/logout",logout);
router.get('/getUsers', getUsers);
router.get('/users/:id', getSingleUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.post("/refresh",refresh);
router.get("/verify",verify);
router.patch(
    '/:id/status',
    toggleUserStatus
  );

module.exports = router;