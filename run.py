from pythoncode.semanticsearch import app
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
if __name__ == '__main__':
    port = 5000
    while port < 5010:
        try:
            print(f"Trying to start on port {port}")
            app.run(host='0.0.0.0', port=port, debug=True)
            break
        except OSError as e:
            if "Address already in use" in str(e):
                port += 1
            else:
                raise
    else:
        print("Failed to find an available port between 5000-5009")