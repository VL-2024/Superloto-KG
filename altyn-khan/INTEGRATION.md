# Алтын Хан — интеграция с X2 LMS

## Состав пакета

- `index.html` — интерфейс и игровая/визуальная логика.
- `config.js` — значения конфигурации по умолчанию.
- `lms-adapter.js` — единый слой связи с LMS (`postMessage`, `PayTicket`, demo/mock).
- `iframe-host-example.html` — минимальный пример запуска игры внутри iframe.
- `assets/` — отдельные графические ассеты.

## Архитектурный принцип

LMS определяет финансовый результат билета и передаёт стандартные данные билета, в том числе `scenario`.
Игра не требует от LMS результатов каждого отдельного броска.

Визуальный подвариант трёх бросков генерируется программно внутри игры и детерминированно от `ticketId + scenario`.
Это правило используется как базовое для моментальных игр X2.

## Сценарии Алтын Хан

| scenario | Результат | Множитель |
|---:|---|---:|
| 1 | 1–3 чүкө | ×0 |
| 2 | 4 чүкө | ×0.5 |
| 3 | 5 чүкө | ×1 |
| 4 | 6 чүкө | ×3 |
| 5 | 7 чүкө | ×4 |
| 6 | 8 чүкө | ×5 |
| 7 | ХАН в 3-м броске | ×10 |
| 8 | ХАН во 2-м броске | ×15 |
| 9 | ХАН в 1-м броске | ×20 |

## LMS API

Базовый URL задаётся в `config.js`:

`https://dev.superloto.kg/api/Lotto.Users.cls`

Покупка билета:

`Lotto.Users.cls?Method=PayTicket&gameId=<gameId>&amount=<denomination>`

В production `gameNumericId` должен быть заменён на фактический ID игры в LMS. Значение `137` в пакете — dev/fallback.

Ожидаемые стандартные поля ответа, которые адаптер умеет нормализовать:

- `ticketId` / `ticket_id` / `id`
- `scenario` / `scenarioId` / `scenario_id`
- `win` / `prize` / `winAmount`
- `balance` / `newBalance`
- `denomination` (опционально)
- `multiplier` (опционально)
- `currency` (опционально)

## postMessage

Игра отправляет наружу:

- `X2_GAME_READY`
- `X2_GAME_DENOMINATION_CHANGED`
- `X2_GAME_MODE_CHANGED`
- `X2_GAME_DEPOSIT_REQUEST`
- `X2_GAME_TICKET_READY`
- `X2_GAME_ROUND_COMPLETE`

Host/LMS может отправлять в игру:

- `X2_LMS_INIT`
- `X2_LMS_SESSION`

`X2_LMS_INIT` может содержать `gameNumericId`, `denomination`, `denominations`, `language`, `currency`, `currencyDisplay`, `mode`, `demoAllowed`, `balance`, `session`.

## URL-параметры для локального/демо запуска

Поддерживаются, среди прочего:

- `gameNumericId`
- `denomination`
- `denominations=25,50,100`
- `language=RU|KG`
- `currency=KGS`
- `currencyDisplay=сом`
- `mode=real|demo`
- `demoAllowed=true|false`
- `demoBalance`
- `scenario=1..9` — принудительный сценарий для тестирования
- `ticketId` — фиксированный ID для воспроизводимости визуального подварианта

## Demo

В demo/mock режиме сценарии идут в последовательности:

`1 → 2 → 1 → 3 → 1 → 4 → 1 → 5 → 1 → 6 → 1 → 7 → 1 → 8 → 1 → 9 → ...`

То есть нулевой сценарий чередуется с выигрышными.

## Важно

Сила/направление броска САКА и физика анимации не меняют финансовый результат билета. Они влияют только на визуальное раскрытие заранее определённого LMS-сценария.
