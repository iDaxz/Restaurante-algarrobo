package pe.algarrobo.config;

import java.nio.file.Path;
import java.time.Clock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Reloj (inyectable para las pruebas), tareas programadas y la página pública.
 * Solo se publican index.html, admin.html, js/ y assets/ de la carpeta del sitio: el resto (backend/, docs/,
 * node_modules/, credenciales) nunca se sirve.
 */
@Configuration
@EnableScheduling
public class AppConfig implements WebMvcConfigurer {

    private final String carpetaSitio;

    public AppConfig(@Value("${algarrobo.sitio.carpeta}") String carpetaSitio) {
        this.carpetaSitio = Path.of(carpetaSitio).toAbsolutePath().normalize().toUri().toString();
    }

    @Bean
    Clock reloj() {
        return Clock.systemUTC();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registro) {
        registro.addResourceHandler("/index.html", "/admin.html").addResourceLocations(carpetaSitio);
        registro.addResourceHandler("/js/**").addResourceLocations(carpetaSitio + "js/");
        registro.addResourceHandler("/assets/**").addResourceLocations(carpetaSitio + "assets/");
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registro) {
        registro.addViewController("/").setViewName("forward:/index.html");
        registro.addRedirectViewController("/admin", "/admin.html");
    }
}
