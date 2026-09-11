import { Router } from 'express';
import { checkAuth } from '../middleware/auth.js';
import { parseCreditBillPdf } from '../services/geminiService.js';

const router = Router();
const MAX_B64_CHARS = Math.ceil(8 * 1024 * 1024 * 4 / 3) + 1024;

router.post('/', checkAuth, async (req, res) => {
  try {
    const base64 = req.body?.base64;
    const mimeType = req.body?.mimeType || 'application/pdf';
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'PDF em base64 é obrigatório' });
    }
    if (base64.length > MAX_B64_CHARS) {
      return res.status(413).json({ error: 'PDF muito grande (limite 8 MB)' });
    }
    const parsed = await parseCreditBillPdf({ base64, mimeType });
    return res.json(parsed);
  } catch (err) {
    console.error('[parse-bill]', err);
    return res.status(500).json({ error: err.message || 'Falha ao ler a fatura' });
  }
});

export default router;
