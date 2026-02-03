
import amqp, { Channel, Connection, ConsumeMessage } from 'amqplib';

let connection: Connection | null = null;
let channel: Channel | null = null;
const QUEUE_NAME = 'document_generation_queue';

export async function connectToRabbitMQ() {
    try {
        const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
        console.log(`Connecting to RabbitMQ at ${rabbitmqUrl}...`);

        connection = await amqp.connect(rabbitmqUrl);
        channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, {
            durable: true
        });

        console.log('Connected to RabbitMQ');

        // Handle connection close
        connection.on('close', () => {
            console.error('RabbitMQ connection closed');
            connection = null;
            channel = null;
            // Reconnect logic could go here
            setTimeout(connectToRabbitMQ, 5000);
        });

        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err);
        });

        return channel;
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error);
        // Retry connection
        setTimeout(connectToRabbitMQ, 5000);
        return null;
    }
}

export async function getChannel(): Promise<Channel | null> {
    if (!channel) {
        await connectToRabbitMQ();
    }
    return channel;
}

export async function publishTask(message: any) {
    try {
        const ch = await getChannel();
        if (!ch) {
            throw new Error('RabbitMQ channel not available');
        }

        const buffer = Buffer.from(JSON.stringify(message));
        const sent = ch.sendToQueue(QUEUE_NAME, buffer, {
            persistent: true
        });

        if (sent) {
            console.log(`Task sent to queue:`, message);
        } else {
            console.error('Failed to send task to queue (buffer full)');
        }

        return sent;
    } catch (error) {
        console.error('Error publishing task:', error);
        return false;
    }
}

export async function consumeTasks(handler: (msg: ConsumeMessage | null) => Promise<void>) {
    const ch = await getChannel();
    if (ch) {
        console.log('Starting consumer...');
        ch.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
            if (msg) {
                try {
                    await handler(msg);
                    ch.ack(msg);
                } catch (error) {
                    console.error('Error processing message:', error);
                    ch.ack(msg);
                }
            }
        }, {
            noAck: false
        });
    }
}
