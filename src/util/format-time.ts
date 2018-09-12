export function formatTime(time: number): string {
    if (!time || isNaN(time)) {
        return '00:00';
    }

    const seconds = time % 60;
    const minutes = Math.floor(time / 60);
    return ('0' + minutes).slice(-2) + ':' + ('0' + seconds).slice(-2);
}