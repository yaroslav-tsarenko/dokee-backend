import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import ora from 'ora';
import chalk from 'chalk';

import documentRoutes from './routes/document.route.js';
import generalRoutes from './routes/general.route.js';
import paymentRoutes from './routes/payment.route.js';
import orderRoutes from './routes/order.route.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const spinner = ora('Connecting to MongoDB...').start();

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        spinner.succeed(chalk.green.bold('✅ MongoDB connected successfully!'));
        const PORT = process.env.PORT || 8800;

        app.use('/documents', documentRoutes);
        app.use('/general-settings', generalRoutes);
        app.use('/order', orderRoutes);   // -> POST /order/save-order
        app.use('/payment', paymentRoutes);

        app.listen(PORT, () => {
            console.log(chalk.cyan.bold(`🚀 Server running on port ${PORT}`));
        });
    })
    .catch(err => {
        spinner.fail(chalk.red.bold('❌ Failed to connect to MongoDB!'));
        console.error(err);
        process.exit(1);
    });
