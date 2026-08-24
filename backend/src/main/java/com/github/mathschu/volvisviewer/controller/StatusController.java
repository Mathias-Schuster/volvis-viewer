package com.github.mathschu.volvisviewer.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:5173")     // CORS!
public class StatusController {

    @GetMapping("/status")
    public String status() {
        return "OK";
    }

}
