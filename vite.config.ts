import reactPlugin from 'vite-plugin-react';
import process from 'process';

export default {
  // @ts-ignore
  jsx: 'react',
  plugins: process.env.NODE_ENV === 'test' ? [] : [reactPlugin],
  test: {
    include: ['**/*.test.ts'],
  },
};
