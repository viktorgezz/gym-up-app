<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { WEIGHT_STEPS } from '../core/limits';
  import { REST_PRESETS } from '../core/rest';
  import { BackupError, backupFileName, createBackup, parseBackup } from '../data/backup';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { countLabel, EXERCISES, formatNumber, formatSec, SETS } from '../lib/format';
  import { isStoragePersisted, requestPersistentStorage, shareFile } from '../services/device';

  // Safari 17.4+ draws a native iOS switch (with haptics) for <input type="checkbox" switch>.
  const nativeSwitch = 'switch' in HTMLInputElement.prototype ? { switch: true } : {};

  let persisted = $state<boolean | null>(null);
  isStoragePersisted().then((p) => (persisted = p));

  async function protectStorage() {
    persisted = await requestPersistentStorage();
    if (!persisted) message = 'iOS пока не разрешил. Чаще всего разрешает приложению, открытому с экрана «Домой».';
  }

  let message = $state('');
  let fileInput: HTMLInputElement;
  let busy = $state(false);

  const WORKOUTS_FORMS = ['тренировка', 'тренировки', 'тренировок'] as const;

  async function exportData() {
    if (busy) return;
    busy = true;
    try {
      const backup = await createBackup();
      const result = await shareFile(backupFileName(), JSON.stringify(backup, null, 2));
      if (result !== 'cancelled') {
        message = `Копия готова: ${countLabel(backup.exercises.length, EXERCISES)}, ${countLabel(backup.sets.length, SETS)}.`;
      }
    } catch (err) {
      console.error(err);
      message = 'Не удалось создать копию.';
    } finally {
      busy = false;
    }
  }

  async function importData(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const date = backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('ru-RU') : '';
      const ok = await ask(
        `Заменить все данные копией${date ? ` от ${date}` : ''}? В ней ${countLabel(backup.exercises.length, EXERCISES)}, ` +
          `${countLabel(backup.workouts.length, WORKOUTS_FORMS)} и ${countLabel(backup.sets.length, SETS)}.` +
          (app.active ? ' Текущая тренировка будет закрыта.' : ''),
        { confirmLabel: 'Заменить данные', danger: true },
      );
      if (!ok) return;
      await app.importBackup(backup);
      message = 'Данные восстановлены из копии.';
    } catch (err) {
      console.error(err);
      message = err instanceof BackupError ? err.message : 'Не удалось прочитать файл.';
    }
  }

  async function reset() {
    const ok = await ask('Удалить все тренировки, упражнения и историю? Если данные нужны, сначала сохраните копию.', {
      confirmLabel: 'Удалить всё',
      danger: true,
    });
    if (!ok) return;
    await app.resetEverything();
    message = 'Все данные удалены.';
  }
</script>

<div class="screen">
  <header class="page-head">
    <h1 class="large-title">Настройки</h1>
  </header>

  <section>
    <h2 class="eyebrow section-title">Тренировка</h2>
    <div class="card group">
      <label class="item">
        <span class="item-text">
          <span class="item-title">Звуки таймера</span>
          <span class="muted small">Играют поверх музыки и не останавливают её. В беззвучном режиме не слышны.</span>
        </span>
        <input
          type="checkbox"
          class="switch"
          {...nativeSwitch}
          checked={app.settings.soundOn}
          onchange={(e) => app.updateSettings({ soundOn: e.currentTarget.checked })}
        />
      </label>
      <label class="item">
        <span class="item-text">
          <span class="item-title">Не гасить экран</span>
          <span class="muted small">Пока идёт тренировка</span>
        </span>
        <input
          type="checkbox"
          class="switch"
          {...nativeSwitch}
          checked={app.settings.keepAwake}
          onchange={(e) => app.updateSettings({ keepAwake: e.currentTarget.checked })}
        />
      </label>
      <label class="item">
        <span class="item-text">
          <span class="item-title">Шаг веса</span>
          <span class="muted small">Сколько добавляют кнопки − и +</span>
        </span>
        <select
          class="value-select"
          value={app.settings.weightStep}
          onchange={(e) => app.updateSettings({ weightStep: Number(e.currentTarget.value) })}
        >
          {#each WEIGHT_STEPS as step (step)}
            <option value={step}>{formatNumber(step)} кг</option>
          {/each}
        </select>
      </label>
      <label class="item">
        <span class="item-text">
          <span class="item-title">Отдых по умолчанию</span>
          <span class="muted small">Потом таймер запоминает выбор для каждого упражнения</span>
        </span>
        <select
          class="value-select"
          value={app.settings.defaultRestSec}
          onchange={(e) => app.updateSettings({ defaultRestSec: Number(e.currentTarget.value) })}
        >
          {#each REST_PRESETS as sec (sec)}
            <option value={sec}>{formatSec(sec)}</option>
          {/each}
          {#if !REST_PRESETS.includes(app.settings.defaultRestSec)}
            <option value={app.settings.defaultRestSec}>{formatSec(app.settings.defaultRestSec)}</option>
          {/if}
        </select>
      </label>
    </div>
  </section>

  <section>
    <h2 class="eyebrow section-title">Данные</h2>
    <div class="card group">
      <button class="item action" disabled={busy} onclick={exportData}>
        <Icon name="share" size={20} /> Экспорт данных
      </button>
      <button class="item action" onclick={() => fileInput.click()}>
        <Icon name="import" size={20} /> Импорт из файла
      </button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importData} />
      <div class="item">
        <span class="item-text">
          <span class="item-title">Защищённое хранилище</span>
          <span class="muted small">
            {persisted ? 'iOS не удалит данные, чтобы освободить место.' : 'При нехватке места iOS может очистить данные.'}
          </span>
        </span>
        {#if persisted === false}
          <button class="btn btn-sm" onclick={protectStorage}>Включить</button>
        {:else if persisted}
          <span class="ok"><Icon name="check" size={22} stroke={2.6} /></span>
        {/if}
      </div>
    </div>
    {#if message}<p class="message" role="status">{message}</p>{/if}
    <p class="muted small note">
      Все данные хранятся только на этом устройстве и никуда не отправляются. Экспорт создаёт JSON-файл — сохраните его в
      «Файлы» или iCloud. Удаление иконки приложения удаляет и данные, поэтому время от времени делайте копию.
    </p>
  </section>

  <section>
    <div class="card group">
      <button class="item action danger" onclick={reset}><Icon name="trash" size={20} /> Удалить все данные</button>
    </div>
    {#if !app.standalone}
      <p class="muted small note">
        Открыто в Safari. Для полноценного приложения нажмите ••• → «Поделиться» → «На экран „Домой“» и запускайте Gym Up с
        иконки.
      </p>
    {/if}
    <p class="muted small note">Gym Up v{__APP_VERSION__}</p>
  </section>
</div>

<style>
  .action {
    justify-content: flex-start;
    color: var(--accent-text);
    font-weight: 600;
  }

  .action:disabled {
    opacity: 0.5;
  }

  .action.danger {
    color: var(--danger);
  }

  .ok {
    display: grid;
    color: var(--accent-text);
  }

  .message {
    margin: 10px 4px 0;
    font-weight: 600;
  }

  .note {
    margin: 10px 4px 0;
  }
</style>
