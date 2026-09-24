#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    branch1_lib::run()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Branch1");
}