/**
 * Clima Hermosillo - Lógica de Aplicación
 * Consume API de Open-Meteo e implementa animaciones de simulación y lluvia.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Coordenadas de Hermosillo, Sonora
    const LAT = 29.073;
    const LON = -110.956;
    const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m`;

    // Elementos DOM del Clima
    const tempNumberEl = document.getElementById('tempNumber');
    const weatherDescEl = document.getElementById('weatherDesc');
    const humidityValEl = document.getElementById('humidityVal');
    const windValEl = document.getElementById('windVal');
    const feelsLikeValEl = document.getElementById('feelsLikeVal');
    const updateTimeEl = document.getElementById('updateTime');
    const weatherIconWrapper = document.getElementById('weatherIconWrapper');
    const statusIndicator = document.getElementById('statusIndicator');

    // Botones
    const btnSimulate = document.getElementById('btnSimulate');
    const btnStorm = document.getElementById('btnStorm');
    const btnReset = document.getElementById('btnReset');

    // Datos de clima real respaldados (fallback o recuperados)
    let realWeatherData = {
        temp: 38,
        desc: "Soleado",
        code: 0,
        humidity: 30,
        wind: 12,
        feelsLike: 40,
        isDay: 1,
        timeString: "--:--"
    };

    // Estado de la Simulación
    let isSimulated = false;

    // --- Sistema de Partículas de Lluvia (Canvas) ---
    const canvas = document.getElementById('rainCanvas');
    const ctx = canvas.getContext('2d');
    let animationFrameId = null;
    let rainDrops = [];
    let isRaining = false;
    let maxDrops = 100;

    // Redimensionar Canvas
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Clase para gotitas de lluvia
    class RainDrop {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height; // Inicializar en posiciones aleatorias verticales al inicio
        }

        reset() {
            const isStormy = document.body.classList.contains('weather-stormy');
            this.x = Math.random() * (canvas.width + 150) - 50;
            this.y = -20;
            this.length = isStormy ? (Math.random() * 25 + 20) : (Math.random() * 20 + 15);
            this.speed = isStormy ? (Math.random() * 18 + 14) : (Math.random() * 12 + 10);
            this.opacity = Math.random() * 0.4 + 0.3;
            this.angle = isStormy ? -6 : -2; // Caída más inclinada por viento en tormenta
        }

        update() {
            this.y += this.speed;
            this.x += this.angle;

            // Si sale de la pantalla, reiniciar arriba
            if (this.y > canvas.height + 20 || this.x < -60 || this.x > canvas.width + 60) {
                if (isRaining) {
                    this.reset();
                }
            }
        }

        draw() {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(156, 163, 175, ${this.opacity})`;
            ctx.lineWidth = document.body.classList.contains('weather-stormy') ? 2 : 1.5;
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.angle, this.y + this.length);
            ctx.stroke();
        }
    }

    // Ajustar la densidad de gotas en ejecución
    function adjustRainDensity(targetCount) {
        if (rainDrops.length < targetCount) {
            const diff = targetCount - rainDrops.length;
            for (let i = 0; i < diff; i++) {
                rainDrops.push(new RainDrop());
            }
        } else if (rainDrops.length > targetCount) {
            rainDrops.length = targetCount;
        }
    }

    // Inicializar gotas
    function initRain(count) {
        rainDrops = [];
        for (let i = 0; i < count; i++) {
            rainDrops.push(new RainDrop());
        }
    }

    // Bucle de Animación de Lluvia
    function animateRain() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let activeDrops = 0;
        rainDrops.forEach(drop => {
            drop.update();
            drop.draw();
            if (drop.y < canvas.height) activeDrops++;
        });

        // Detener animación si ya no llueve y no quedan gotas en pantalla
        if (!isRaining && activeDrops === 0) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        animationFrameId = requestAnimationFrame(animateRain);
    }

    // Encender lluvia
    function startRainEffect(densityClass) {
        const targetCount = densityClass === 'weather-stormy' ? 250 : 100;
        if (!isRaining) {
            isRaining = true;
            initRain(targetCount);
            if (!animationFrameId) {
                animateRain();
            }
        } else {
            adjustRainDensity(targetCount);
        }
    }

    function stopRainEffect() {
        isRaining = false;
    }

    // --- Mapeo de Códigos WMO de Open-Meteo ---
    function getWeatherInfo(code, isDay) {
        if (code === 0) {
            return isDay ? 
                { desc: "Soleado y despejado", icon: "sun", class: "weather-sunny" } : 
                { desc: "Despejado de noche", icon: "moon", class: "weather-night" };
        }
        if ([1, 2, 3].includes(code)) {
            return { desc: "Parcialmente nublado", icon: "cloud-sun", class: "weather-normal" };
        }
        if ([45, 48].includes(code)) {
            return { desc: "Niebla", icon: "cloud-fog", class: "weather-normal" };
        }
        if ([51, 53, 55, 56, 57].includes(code)) {
            return { desc: "Llovizna ligera", icon: "cloud-drizzle", class: "weather-rainy" };
        }
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
            return { desc: "Lluvia", icon: "cloud-rain", class: "weather-rainy" };
        }
        if ([71, 73, 75, 77, 85, 86].includes(code)) {
            return { desc: "Nevada", icon: "cloud-snow", class: "weather-normal" };
        }
        if ([95, 96, 99].includes(code)) {
            return { desc: "Tormenta eléctrica", icon: "cloud-lightning", class: "weather-rainy" };
        }
        return { desc: "Nublado", icon: "cloud", class: "weather-normal" };
    }

    // --- Cargar Clima de Hermosillo de la API ---
    async function fetchWeather() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Error en respuesta de servidor API");
            
            const data = await response.json();
            const current = data.current;
            const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);

            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            realWeatherData = {
                temp: Math.round(current.temperature_2m),
                desc: weatherInfo.desc,
                code: current.weather_code,
                humidity: current.relative_humidity_2m,
                wind: Math.round(current.wind_speed_10m),
                feelsLike: Math.round(current.apparent_temperature),
                isDay: current.is_day,
                class: weatherInfo.class,
                icon: weatherInfo.icon,
                timeString: timeString
            };

            applyWeatherState(realWeatherData);

        } catch (error) {
            console.error("No se pudo obtener el clima en tiempo real:", error);
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            realWeatherData = {
                temp: 40,
                desc: "Despejado (Servicio alternativo)",
                code: 0,
                humidity: 25,
                wind: 10,
                feelsLike: 43,
                isDay: 1,
                class: "weather-sunny",
                icon: "sun",
                timeString: timeString + " (Local)"
            };

            applyWeatherState(realWeatherData);
            if (weatherDescEl) weatherDescEl.textContent = `${realWeatherData.desc} [Offline]`;
        }
    }

    // --- Aplicar un Estado del Clima a la UI ---
    function applyWeatherState(stateData) {
        if (tempNumberEl) tempNumberEl.textContent = stateData.temp;
        if (weatherDescEl) weatherDescEl.textContent = stateData.desc;
        if (humidityValEl) humidityValEl.textContent = `${stateData.humidity}%`;
        if (windValEl) windValEl.textContent = `${stateData.wind} km/h`;
        if (feelsLikeValEl) feelsLikeValEl.textContent = `${stateData.feelsLike}°C`;
        if (updateTimeEl) updateTimeEl.textContent = `Última actualización: ${stateData.timeString}`;

        document.body.className = '';
        document.body.classList.add(stateData.class || 'weather-normal');

        if (stateData.class === 'weather-rainy' || stateData.class === 'weather-stormy') {
            startRainEffect(stateData.class);
        } else {
            stopRainEffect();
        }

        if (weatherIconWrapper) {
            weatherIconWrapper.innerHTML = `<i data-lucide="${stateData.icon}" class="main-weather-icon"></i>`;
        }
        
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // --- Control de Simulación ---
    function triggerSunnySimulation() {
        isSimulated = true;
        
        if (btnSimulate) btnSimulate.disabled = true;
        if (btnStorm) btnStorm.disabled = true;
        if (btnReset) btnReset.disabled = false;

        if (statusIndicator) {
            statusIndicator.innerHTML = '<span class="dot"></span> Clima Corregido';
            statusIndicator.style.background = 'rgba(251, 191, 36, 0.15)';
            statusIndicator.style.border = '1px solid rgba(251, 191, 36, 0.2)';
        }

        const simulatedData = {
            temp: 35,
            desc: "Día Soleado Agradable (Corregido)",
            code: 0,
            humidity: 20,
            wind: 5,
            feelsLike: 37,
            isDay: 1,
            class: "weather-sunny",
            icon: "sun",
            timeString: "Corregido hace un momento"
        };

        applyWeatherState(simulatedData);
    }

    function triggerStormSimulation() {
        isSimulated = true;

        if (btnSimulate) btnSimulate.disabled = true;
        if (btnStorm) btnStorm.disabled = true;
        if (btnReset) btnReset.disabled = false;

        if (statusIndicator) {
            statusIndicator.innerHTML = '<span class="dot"></span> Clima Simulado';
            statusIndicator.style.background = 'rgba(168, 85, 247, 0.15)';
            statusIndicator.style.border = '1px solid rgba(168, 85, 247, 0.2)';
        }

        const simulatedData = {
            temp: 24,
            desc: "Tormenta Eléctrica (Simulado)",
            code: 95,
            humidity: 95,
            wind: 45,
            feelsLike: 23,
            isDay: 1,
            class: "weather-stormy",
            icon: "cloud-lightning",
            timeString: "Simulado hace un momento"
        };

        applyWeatherState(simulatedData);
    }

    function resetToRealWeather() {
        isSimulated = false;

        if (btnSimulate) btnSimulate.disabled = false;
        if (btnStorm) btnStorm.disabled = false;
        if (btnReset) btnReset.disabled = true;

        if (statusIndicator) {
            statusIndicator.innerHTML = '<span class="dot"></span> Clima Real';
            statusIndicator.style.background = 'rgba(255, 255, 255, 0.06)';
            statusIndicator.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        }

        applyWeatherState(realWeatherData);
    }

    // Controladores de Eventos
    if (btnSimulate) btnSimulate.addEventListener('click', triggerSunnySimulation);
    if (btnStorm) btnStorm.addEventListener('click', triggerStormSimulation);
    if (btnReset) btnReset.addEventListener('click', resetToRealWeather);

    // Carga inicial
    fetchWeather();
});