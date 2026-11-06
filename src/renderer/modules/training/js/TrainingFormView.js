import { TrainingViewBase } from './TrainingViewBase.js';

export class TrainingFormView extends TrainingViewBase {
    constructor(doc, calculator, t) {
        super(doc, t);
        this.calculator = calculator;
    }

    setDefaultDate(dateStr) {
        this.byId('workout-date').value = dateStr;
    }

    bindAdd({ onSave, onAddExercise, onSaveTemplate, onApplyTemplate }) {
        this.byId('save-workout-btn').addEventListener('click', onSave);
        this.byId('add-exercise-btn').addEventListener('click', onAddExercise);
        this.byId('save-template-btn').addEventListener('click', onSaveTemplate);
        this.byId('apply-template-btn').addEventListener('click', onApplyTemplate);
    }

    bindEdit({ onSave, onAddExercise, onClose }) {
        this.byId('save-edit-btn').addEventListener('click', onSave);
        this.byId('edit-add-exercise-btn').addEventListener('click', onAddExercise);
        this.byId('edit-modal-close').addEventListener('click', onClose);
    }

    readAdd() {
        return {
            date: this.byId('workout-date').value,
            start_time: this.byId('workout-start').value,
            end_time: this.byId('workout-end').value,
            type: this.byId('workout-type').value,
            note: this.byId('workout-note').value,
            exercises: this.readExercises('exercises-container')
        };
    }

    readEdit() {
        return {
            date: this.byId('edit-date').value,
            start_time: this.byId('edit-start').value,
            end_time: this.byId('edit-end').value,
            type: this.byId('edit-type').value,
            note: this.byId('edit-note').value,
            exercises: this.readExercises('edit-exercises-container')
        };
    }

    readExercises(containerId) {
        const rows = this.byId(containerId).querySelectorAll('.exercise-row');
        const raw = [];
        for (const row of rows) {
            raw.push({
                name: row.querySelector('.ex-name').value,
                sets: row.querySelector('.ex-sets').value,
                reps: row.querySelector('.ex-reps').value,
                weight: row.querySelector('.ex-weight').value,
                note: row.querySelector('.ex-note').value
            });
        }
        return this.calculator.parseExercises(raw);
    }

    readTemplateName() {
        return this.byId('template-name').value.trim();
    }

    clearTemplateName() {
        this.byId('template-name').value = '';
    }

    readTemplateId() {
        return parseInt(this.byId('template-select').value, 10);
    }

    addExerciseRow(containerId, values) {
        const container = this.byId(containerId);
        const row = this.el('div', 'exercise-row');

        const name = this.el('input');
        name.type = 'text';
        name.className = 'ex-name';
        name.placeholder = this.t('form.exercise');

        const sets = this.el('input');
        sets.type = 'number';
        sets.className = 'ex-sets';
        sets.placeholder = this.t('form.sets');
        sets.min = '1';

        const reps = this.el('input');
        reps.type = 'number';
        reps.className = 'ex-reps';
        reps.placeholder = this.t('form.reps');
        reps.min = '1';

        const weight = this.el('input');
        weight.type = 'number';
        weight.className = 'ex-weight';
        weight.placeholder = this.t('form.weight');
        weight.step = '0.5';
        weight.min = '0';

        const note = this.el('input');
        note.type = 'text';
        note.className = 'ex-note';
        note.placeholder = this.t('form.note');

        const remove = this.el('button', 'remove-exercise', '✕');
        remove.addEventListener('click', () => {
            if (container.children.length > 1) {
                row.remove();
            }
        });

        if (values) {
            name.value = values.exercise_name || '';
            sets.value = values.sets || '';
            reps.value = values.reps || '';
            weight.value = values.weight || '';
            note.value = values.note || '';
        }

        row.append(name, sets, reps, weight, note, remove);
        container.append(row);
    }

    clearAddAfterSave() {
        this.byId('workout-start').value = '';
        this.byId('workout-end').value = '';
        this.byId('workout-note').value = '';
        const container = this.byId('exercises-container');
        container.replaceChildren();
        this.addExerciseRow('exercises-container');
    }

    fillEdit(workout) {
        this.byId('edit-date').value = workout.date;
        this.byId('edit-start').value = workout.start_time || '';
        this.byId('edit-end').value = workout.end_time || '';
        this.byId('edit-type').value = workout.type;
        this.byId('edit-note').value = workout.note || '';
        const container = this.byId('edit-exercises-container');
        container.replaceChildren();
        for (const exercise of workout.exercises || []) {
            this.addExerciseRow('edit-exercises-container', exercise);
        }
    }

    openEdit() {
        this.byId('edit-modal').classList.add('active');
    }

    closeEdit() {
        this.byId('edit-modal').classList.remove('active');
    }

    showAddStatus(kind, text, hideMs) {
        this.setStatus('add-status', kind, text, hideMs);
    }

    showEditStatus(kind, text, hideMs) {
        this.setStatus('edit-status', kind, text, hideMs);
    }

    renderTemplates(templates) {
        const list = Array.isArray(templates) ? templates : [];
        const select = this.byId('template-select');
        select.replaceChildren();
        const empty = this.el('option', null, this.t('template.selectPlaceholder'));
        empty.value = '';
        select.append(empty);
        for (const template of list) {
            const option = this.el('option', null, template.name);
            option.value = template.id;
            select.append(option);
        }
    }
}