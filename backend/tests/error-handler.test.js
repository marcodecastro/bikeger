import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { INTERNAL_ERROR_MESSAGE } from '../src/utils/security.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test('produção esconde detalhe do 500 e mantém mensagem do 409', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousError = console.error;
  process.env.NODE_ENV = 'production';
  console.error = () => undefined;

  const serverError = new Error('E11000 duplicate key no índice one_open_register');
  const res500 = mockRes();
  errorHandler(serverError, {}, res500, () => undefined);
  assert.equal(res500.statusCode, 500);
  assert.equal(res500.body.message, INTERNAL_ERROR_MESSAGE);

  const closed = new Error('Nenhum caixa aberto. Abra o caixa para registrar este movimento.');
  closed.status = 409;
  const res409 = mockRes();
  errorHandler(closed, {}, res409, () => undefined);
  assert.equal(res409.statusCode, 409);
  assert.equal(res409.body.message, closed.message);

  console.error = previousError;
  process.env.NODE_ENV = previousEnv;
});

test('desenvolvimento ainda devolve a mensagem do 500', () => {
  const previousEnv = process.env.NODE_ENV;
  const previousError = console.error;
  process.env.NODE_ENV = 'development';
  console.error = () => undefined;

  const serverError = new Error('falha no populate do cliente');
  const res = mockRes();
  errorHandler(serverError, {}, res, () => undefined);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, 'falha no populate do cliente');

  console.error = previousError;
  process.env.NODE_ENV = previousEnv;
});
