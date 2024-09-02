# TimeEditFilter
https://timeedited.emrik.org/

Removes "Course name:" and other nonsense from TimeEdit ics url. Also allows you to hide courses and exams.

## Tips
Add https://github.com/EdvinNilsson/chalmersCalendar as a separate calendar for better exam events.

## Self host
```yml
#docker-compose.yml

services:
  timeedited:
    image: ghcr.io/c4illin/timeedited:main
    container_name: timeedited
    restart: unless-stopped
    volumes:
      - ./config:/usr/src/app/config
    ports:
      - 3000:3000
```
