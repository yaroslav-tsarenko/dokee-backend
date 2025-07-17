import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import ora from 'ora';
import chalk from 'chalk';
import documentRoutes from './routes/document.route.js';
import generalRoutes from './routes/general.route.js';

const app = express();
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(fileUpload());
const spinner = ora('Connecting to MongoDB...').start();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        spinner.succeed(chalk.green.bold('✅ MongoDB connected successfully!'));
        const PORT = process.env.PORT || 5000;
        app.use('/documents', documentRoutes);
        app.use('/general-settings', generalRoutes);
        app.listen(PORT, () => {
            console.log(chalk.cyan.bold(`🚀 Server running on port ${PORT}`));
        });
    })
    .catch(err => {
        spinner.fail(chalk.red.bold('❌ Failed to connect to MongoDB!'));
        console.error(err);
        process.exit(1);
    });