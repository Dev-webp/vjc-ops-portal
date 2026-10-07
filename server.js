require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const leadRoutes = require('./routes/leads');
const auditRoutes = require('./routes/audits');
const caseRoutes = require('./routes/cases');
const documentRoutes = require('./routes/documents');
const caseDetailsRoutes = require('./routes/caseDetails');
const notificationRoutes = require('./routes/notifications');
const employeeRoutes = require('./routes/employees');
const reportsRoutes = require('./routes/reports');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/case-documents', documentRoutes);
app.use('/api/case-details', caseDetailsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportsRoutes);
app.get('/health', (req, res) => res.json({ ok: true }));

// Fallback errors from multer etc.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`\n  VJC Ops Portal running → http://localhost:${PORT}\n`);
});
