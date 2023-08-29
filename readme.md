# TimeEditFilter
https://timeedited.emrik.org/

Removes "Course name:" from TimeEdit ics url. Also allows you to hide courses and exams.

## Tips
Add "&p=52" to the end of TimeEdit to get the 52 week view. (before exporting to ics)

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
