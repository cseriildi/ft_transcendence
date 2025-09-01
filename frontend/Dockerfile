FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm config set strict-ssl false
RUN rm -rf node_modules package-lock.json && npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]