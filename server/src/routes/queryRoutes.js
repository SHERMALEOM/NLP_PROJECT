import { Router } from 'express';
import { execute, generate, listEmployees } from '../controllers/queryController.js';

const router = Router();
router.post('/queries/generate', generate);
router.post('/queries/execute', execute);
router.get('/employees', listEmployees);
export default router;
