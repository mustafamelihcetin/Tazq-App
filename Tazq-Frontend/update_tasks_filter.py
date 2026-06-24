import re

def update_tasks_filter():
    with open('app/tasks.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the useMemo for filteredAndSortedTasks
    # It currently starts with:
    #   const filteredAndSortedTasks = useMemo(() => {
    #     let result = tasks.filter(task => {

    old_filter = "    let result = tasks.filter(task => {"
    new_filter = """    let result = tasks.filter(task => {
      // Hide archived tasks from the main list
      if (task.isArchived) return false;"""
      
    if "if (task.isArchived) return false;" not in content:
        content = content.replace(old_filter, new_filter)

    with open('app/tasks.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Updated tasks.tsx to filter out archived tasks!")

update_tasks_filter()
