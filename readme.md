# TimeEditFilter


## Tips
Add "&p=52" to the end of TimeEdit to get the 52 week view.

Add https://github.com/EdvinNilsson/chalmersCalendar as a separate calendar

## Installation
```yml
#docker-compose.yml

services:
  TimeEdited:
    image: ghcr.io/c4illin/timeedited:main
    container_name: TimeEdited
    restart: unless-stopped
    ports:
      - 3000:3000
```
