import { publishTask, consumeTasks, connectToRabbitMQ } from '../server/rabbitmq';

async function main() {
    console.log('Connecting to RabbitMQ...');
    await connectToRabbitMQ();

    console.log('Setting up consumer...');
    await consumeTasks(async (msg) => {
        if (msg) {
            console.log('Received message:', msg.content.toString());
            console.log('Verification SUCCESS!');
            process.exit(0);
        }
    });

    console.log('Publishing test message...');
    await publishTask({ type: 'test', payload: { foo: 'bar' } });

    // Timeout if no message received
    setTimeout(() => {
        console.error('Timeout: No message received within 5 seconds.');
        process.exit(1);
    }, 5000);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
