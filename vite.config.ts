import reactPlugin from 'vite-plugin-react';
import process from 'process';

export default {
  jsx: 'react',
  plugins: process.env.NODE_ENV === 'test' ? [] : [reactPlugin],
  optimizeDeps: {
    include: ['react-dom/client'],
  },
  test: {
    include: ['**/*.test.ts'],
  },
};
