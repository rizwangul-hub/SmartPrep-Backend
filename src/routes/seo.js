// backend/src/routes/seo.js
'use strict';

const express = require('express');
const router = express.Router();
const seoController = require('../controllers/seoController');

// Sitemap XML route
router.get('/sitemap.xml', seoController.getSitemap);

// Dynamic SEO content retrieval routes
router.get('/content/:slug', seoController.getSeoContent);
router.get('/blog/content/:slug', seoController.getSeoContent);

module.exports = router;
