const express = require('express');
const { findMatch } = require('../controllers/matchController');
const router = express.Router();

router.post('/match', findMatch);

module.exports = router;