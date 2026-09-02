АЛТЫН ХАН — X2 LOTO

Структура пакета соответствует интеграционному формату игры «Выбей Хана v19»:

  index.html
  config.js
  lms-adapter.js
  iframe-host-example.html
  INTEGRATION.md
  README.txt
  assets/

Локальный запуск:
  откройте через HTTP-сервер (не file://), например:
  python -m http.server 8080
  затем http://localhost:8080/index.html?mode=demo

Тест конкретного LMS-сценария:
  ?mode=demo&scenario=1
  ...
  ?mode=demo&scenario=9

Текущая версия содержит отдельные ассеты, drag/tap бросок САКА, звук, эффекты удара,
детерминированные визуальные подварианты и demo-последовательность сценариев.
