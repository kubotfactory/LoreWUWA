from fasthtml.common import *

app, rt = fast_app()

@rt('/')
def get():
    return Div(H1('Hello World from FastHTML on Vercel!'))

# ห้ามเรียก serve() ลอยๆ ให้ใส่เงื่อนไขนี้ไว้สำหรับรันในเครื่องตัวเองเท่านั้น
if __name__ == '__main__':
    serve()
