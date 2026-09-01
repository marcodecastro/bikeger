import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin';

async function main() {
  await mongoose.connect(uri, { directConnection: true });
  const admin = mongoose.connection.db.admin();
  const hello = await admin.command({ hello: 1 });

  if (hello.setName) {
    console.log(`Replica set já ativo: ${hello.setName}`);
    await mongoose.disconnect();
    return;
  }

  try {
    const result = await admin.command({
      replSetInitiate: {
        _id: 'rs0',
        members: [{ _id: 0, host: '127.0.0.1:27017' }],
      },
    });
    console.log('Replica set rs0 iniciado.', result.ok === 1 ? 'ok' : result);
  } catch (error) {
    console.error('Não foi possível iniciar o replica set:', error.message);
    console.error('Suba o Mongo com --replSet rs0 (docker compose up -d) e rode de novo: npm run replica');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
